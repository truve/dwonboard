# Recorded Future API - Skills Document

Learnings and patterns from building the Dark Web Monitoring Onboarding Service.

## Setup

### Python SDK
```bash
pip install rfapi
```

### Client Initialization
```python
from rfapi import RawApiClient

client = RawApiClient(auth="YOUR_RF_TOKEN", timeout=(30, 600))
```

All queries go through `client.query(query_dict).result`, which returns a dict.

### Authentication
- SDK: Pass token via constructor `auth=` parameter
- Direct HTTP: Use header `X-RFToken: YOUR_TOKEN`

---

## Query Patterns

### 1. Entity Search (Find a Company by Name)

Find an RF entity ID for a company name. Returns candidates ranked by relevance.

```python
query = {
    "entity": {
        "type": "Company",    # or "Person", "Organization", "Vessel", etc.
        "freetext": "Swedbank",
        "limit": 10
    }
}
result = client.query(query).result
# result = {
#   "entities": ["B_Gbo", "B_L_k", ...],     # list of entity IDs
#   "entity_details": {
#     "B_Gbo": {"name": "Swedbank", "type": "Company", ...},
#     "B_L_k": {"name": "Swedbank AB", "type": "Company", ...},
#   },
#   "count": {...},
# }
```

### 2. Entity Name Resolution (Bulk ID → Name Lookup)

Resolve internal RF entity IDs to human-readable names. Batch up to ~100 IDs per call.

```python
query = {
    "entity": {
        "id": ["B_Gbo", "mi6FCj", "nlflWX"],
        "limit": 100
    }
}
result = client.query(query).result
# result["entity_details"]["B_Gbo"] = {"name": "Swedbank", "type": "Company"}
# result["entity_details"]["mi6FCj"] = {"name": "RipperSec", "type": "ThreatActor"}
# result["entity_details"]["nlflWX"] = {"name": "Cobalt Strike", "type": "Malware"}
```

**Note:** Some entity IDs are already human-readable with prefixes:
- `idn:swedbank.se` → domain
- `ip:1.2.3.4` → IP address
- `email:user@example.com` → email
- `hash:abc123...` → file hash
- `mitre:T1498` → MITRE ATT&CK technique
- `source:VKz42X` → source

These don't need resolution.

### 3. Reference Search (Dark Web / Cyber Events)

Fetch references (mentions, events, incidents) related to entities. This is the core query for threat intelligence.

#### Dark Web References (All Content from Dark Web Sources)

Uses the magic entity `OYHH7k` as a media type filter to restrict results to dark web sources only.

```python
query = {
    "reference": {
        "document": {
            "published": {
                "min": "2026-03-24",    # inclusive
                "max": "2026-03-25"     # exclusive (next day)
            }
        },
        "attributes": [
            {
                "entity": {"id": ["OYHH7k"]},                          # dark web media type
                "name": [["Event.document", "Source.media_type"]]       # attribute filter
            },
            {"entity": {"id": ["B_Gbo", "idn:swedbank.se"]}}          # target entities
        ],
        "limit": 200
    }
}
```

#### Cyber Risk References (All Sources, Cyber Event Types)

No media type filter — searches all sources but only cyber-relevant event types.

```python
RF_TYPE_MAP = {
    "CredentialLeak": "credentials_dump",
    "CardDump": "credentials_dump",
    "CyberAttack": "access_sale",
    "CyberExploit": "vulnerability",
    "DisclosedVulnerability": "vulnerability",
    "WebReportedVulnerability": "vulnerability",
    "UpdatedVulnerability": "vulnerability",
    "MalwareAnalysis": "other",
    "ServiceDisruption": "other",
    "DDoSTrafficAnalysis": "other",
    "NetworkTrafficAnalysis": "other",
    "SnortRule": "other",
    "WhoisUpdate": "other",
    "WebsiteScan": "other",
    "InfrastructureAnalysis": "other",
    "TTPAnalysis": "other",
}

query = {
    "reference": {
        "type": list(RF_TYPE_MAP.keys()),
        "document": {
            "published": {
                "min": "2026-03-24",
                "max": "2026-03-25"
            }
        },
        "attributes": [
            {"entity": {"id": ["B_Gbo", "idn:swedbank.se"]}}
        ],
        "limit": 200
    }
}
```

#### Parsing Reference Responses

The response can have data under different keys depending on the query:

```python
result = client.query(query).result

# Try these keys in order:
references = (
    result.get("references")
    or result.get("instances")
    or result.get("items")
    or []
)

# Total count (may be nested):
count = result.get("count", {})
# Could be: {"references": {"total": 42}} or {"total": 42}
```

Each reference looks like:
```python
{
    "id": "HFCtAAHQMJf",
    "type": "CredentialLeak",           # event type
    "fragment": "The actual text...",    # key content
    "start": "2026-03-09T00:00:00Z",   # timestamp (alternative)
    "document": {
        "title": "Document title",
        "published": "2026-03-09T00:00:00Z",  # or {"date": "..."}
        "url": "https://...",
        "sourceId": {"name": "Russian Market", "id": "source:fFCO65"}
    },
    "attributes": ["entity_id_1", "entity_id_2"]  # can be strings or dicts
}
```

**Important:** The `attributes` field can contain either strings or dicts — handle both:
```python
for attr in ref.get("attributes", []):
    if isinstance(attr, str):
        tags.append(attr)
    elif isinstance(attr, dict):
        entity_info = attr.get("entity", {})
        # ...
```

### 4. Intelligence Card (Company Risk Profile)

Returns the full risk profile for a company: risk score, risk rules, metrics, related entities, recent sightings.

```python
query = {
    "from": {
        "datagroup": "Company",     # see datagroup types below
        "function": "default"
    },
    "where": {
        "direct": {
            "entity": {"id": "B_Gbo"}
        }
    },
    "sort": [{"field": ["stats.weight"], "order": "desc"}],
    "limit": 1
}
result = client.query(query).result
```

#### Intelligence Card Response Structure

```python
result = {
    "result": {
        "items": [{
            "stats": {
                "metrics": {
                    "riskScore": 64,              # 0-100
                    "darkWebHits": 52183,
                    "undergroundForumHits": 1415,
                    "pasteHits": 21791,
                    "cyberAttackHits": 1760,
                    "socialMediaHits": 1413,
                    "totalHits": 48542,
                    "sevenDaysHits": 8,
                    "sixtyDaysHits": 208,
                    "rules": 23,                  # triggered rules
                    "maxRules": 54,               # total possible rules
                    # ... many more metrics
                },
                "entity_lists": {
                    "RelatedThreatActor": [{"id": "mi6FCj", "count": 3}, ...],
                    "RelatedMalware": [{"id": "nlflWX", "count": 3219}, ...],
                    "RelatedCompany": [...],
                    "RelatedInternetDomainName": [{"id": "idn:swedbank.se", "count": 2164}, ...],
                    "RelatedIpAddress": [...],
                    "RelatedCyberVulnerability": [...],
                    "RelatedTechnology": [...],
                    "RelatedCountry": [...],
                    "RelatedEmailAddress": [...],
                    "RelatedHash": [...],
                    "RelatedProduct": [...],
                    "RelatedAttackVector": [...],
                    "RelatedMethod": [...],           # MITRE ATT&CK
                    "RelatedMalwareCategory": [...],
                    "RelatedUsername": [...],
                    "RelatedOrganization": [...],
                    "RelatedOperation": [...],
                    "RelatedAttacker": [...],
                },
                "stats": {
                    "riskSummary": "23 of 54 Risk Rules currently observed.",
                    "criticalityLabel": "Moderate",
                    "evidenceDetails": [
                        {
                            "Name": "recentMarketHighVolume",
                            "Rule": "High Volume of Recent Attention on Dark Web Markets",
                            "RuleCategory": "Dark Web",
                            "EvidenceString": "220 recent sightings out of 25,862...",
                            "CriticalityLabel": "Moderate",
                            "Criticality": 2,          # 1=Info, 2=Moderate, 3=Critical, 4=Very Critical
                            "SightingsCount": 220,
                            "SourcesCount": 1,
                            "Sources": ["Recorded Future Dark Web Collection"],
                            "Timestamp": "2025-11-14T00:00:00.000Z",
                        },
                        # ... more rules
                    ],
                    "mediaTypes": {
                        "Dark Web / Special Access Forum": 9721,
                        "Dark Web Market": 41889,
                        "Paste Site": 21791,
                        # ...
                    },
                    "topics": {
                        "Cyber": 33086,
                        "Business/Finance": 35698,
                        "Technology/Internet": 27477,
                        # ...
                    },
                    "counts": {
                        "2026-03-22": 6,    # daily reference counts (historical)
                        "2026-03-17": 4,
                        # ...
                    },
                    "recentDarkWeb": {
                        "reference": "HFCtAAHQMJf",
                        "fragment": "...",
                        "source": {"name": "Russian Market", "id": "source:fFCO65"},
                        "published": "2026-03-09T00:00:00.000Z",
                        "title": "...",
                        "url": "..."
                    },
                    "recentSocialMedia": { /* same structure */ },
                    "recentUndergroundForum": { /* same structure */ },
                    "recentCyberAttack": { /* same structure */ },
                    "recentPaste": { /* same structure */ },
                    "recentInfoSec": { /* same structure */ },
                    "first": { /* earliest reference ever */ },
                    "mostRecent": { /* most recent reference */ },
                    "credentialExtensionData": [
                        {
                            "allTimeExtensionDataCredentialsWithPassword": [
                                {
                                    "credentialsCount": 1009,
                                    "documentUrl": "url:...",
                                    "documentTitle": "LinkedIn Data Dump File - May 2016"
                                },
                                # ...
                            ]
                        },
                        {
                            "recentExtensionDataCredentialsWithPassword": [...]
                        }
                    ],
                },
            },
            "attributes": {
                "entities": ["B_Gbo"],
                "start": "2012-10-02T...",
                "stop": "2026-03-24T..."
            },
            "weight": 0.64
        }]
    }
}
```

**Note:** Evidence strings contain RF entity markup like `<e id=entityId>Display Name</e>`. Strip with:
```python
import re
clean = re.sub(r'<e[^>]*>', '', text).replace('</e>', '')
```

---

## Key Concepts

### Entity ID Formats
| Prefix | Type | Example |
|--------|------|---------|
| (none) | Internal RF ID | `B_Gbo`, `mi6FCj` |
| `idn:` | Domain | `idn:swedbank.se` |
| `ip:` | IP Address | `ip:1.2.3.4` |
| `email:` | Email | `email:user@example.com` |
| `hash:` | File Hash | `hash:abc123...` |
| `mitre:` | MITRE ATT&CK | `mitre:T1498` |
| `source:` | Source | `source:VKz42X` |
| `url:` | URL | `url:https://...` |

### Intelligence Card Datagroups

Used with the `"from": {"datagroup": "..."}` query to get risk scores and detailed intel for different entity types.

| Datagroup | Entity Type | Entity ID Format |
|-----------|-------------|------------------|
| `Company` | Organizations | Internal ID (e.g. `B_Gbo`) |
| `InternetDomainName` | Domains | `idn:example.com` |
| `IpAddress` | IP Addresses | `ip:1.2.3.4` |
| `URL` | URLs | `url:https://...` |

#### Getting Risk Scores for IOCs (Domains, IPs, URLs)

Use the Intelligence Card query with the appropriate datagroup to get risk scores for indicators of compromise. The batch entity lookup (`"entity": {"id": [...]}`) does **not** return risk scores — you must use intel cards.

```python
# Example: Get risk score for a domain
query = {
    "from": {"datagroup": "InternetDomainName", "function": "default"},
    "where": {"direct": {"entity": {"id": "idn:malicious-site.com"}}},
    "sort": [{"field": ["stats.weight"], "order": "desc"}],
    "limit": 1
}
result = client.query(query).result
item = result.get("result", {}).get("items", [None])[0]
risk_score = item["stats"]["metrics"]["riskScore"]       # 0-100
rules = item["stats"]["metrics"]["rules"]                # triggered rules count
max_rules = item["stats"]["metrics"]["maxRules"]          # total possible rules
criticality = item["stats"]["stats"]["criticalityLabel"]  # "Low", "Moderate", "Critical", etc.
```

**Performance note:** Each intel card query takes 5-30 seconds. Deduplicate IOCs before looking them up. For alerts with many IOCs, this is the bottleneck.

### Media Type Entity IDs

Used in reference query `attributes` to filter by source media type. Use with `"name": [["Event.document", "Source.media_type"]]`.

```python
# Example: Filter to dark web sources only
"attributes": [
    {
        "entity": {"id": ["OYHH7k"]},
        "name": [["Event.document", "Source.media_type"]]
    },
    {"entity": {"id": [target_entity_id]}}
]
```

| ID | Media Type |
|----|-----------|
| `JxSEs2` | Mainstream |
| `JxSDuU` | Blog |
| `JxRsrB` | Niche |
| `LkX0BI` | IRC Channels |
| `OYHH7k` | Dark Web |
| `Ohgw3r` | App Stores |
| `Jyfb4z` | Forum |
| `JxSEtC` | Social Media |
| `KDS1Zp` | Paste Sites |
| `POdRlc` | Code Repositories |
| `JxSEs4` | Government |
| `JxSEtH` | Scientific Journals |
| `JxSEs9` | News Agencies |
| `KoaocP` | Malware/Vulnerability Technical Reporting |
| `VRKFLh` | Security Breach Technical Reporting |
| `JxSEs8` | NGO |
| `WFhHfd` | Dark Web Data Dumps |

You can combine multiple media types in a single query:
```python
"entity": {"id": ["OYHH7k", "WFhHfd", "KDS1Zp"]}  # Dark Web + Data Dumps + Paste Sites
```

### Date Formats
- Reference queries: `"min": "YYYY-MM-DD", "max": "YYYY-MM-DD"` (min inclusive, max exclusive)
- Alternative: `"time_range": "-10d to today"` (relative, but less precise)
- Timestamps in responses: ISO 8601 `"2026-03-24T00:00:00.000Z"`

### Risk Criticality Levels
| Value | Label |
|-------|-------|
| 1 | Informational |
| 2 | Moderate |
| 3 | Critical |
| 4 | Very Critical |

### Event Types (for `type` filter in reference queries)
```
CredentialLeak, CardDump, CyberAttack, CyberExploit,
DisclosedVulnerability, WebReportedVulnerability, UpdatedVulnerability,
MalwareAnalysis, ServiceDisruption, DDoSTrafficAnalysis,
NetworkTrafficAnalysis, SnortRule, WhoisUpdate, WebsiteScan,
InfrastructureAnalysis, TTPAnalysis
```

### Entity List Types (from Intelligence Card)
```
RelatedThreatActor, RelatedMalware, RelatedCyberVulnerability,
RelatedAttackVector, RelatedMethod, RelatedCompany,
RelatedOrganization, RelatedInternetDomainName, RelatedIpAddress,
RelatedTechnology, RelatedProduct, RelatedCountry,
RelatedMalwareCategory, RelatedEmailAddress, RelatedHash,
RelatedUsername, RelatedOperation, RelatedAttacker
```

---

## Practical Tips

### Day-by-Day Fetching
For large date ranges, query one day at a time with `min`/`max` date range. This avoids hitting limits and allows incremental progress display.

```python
for days_back in range(15):
    query_date = today - timedelta(days=days_back)
    next_day = query_date + timedelta(days=1)
    query["reference"]["document"]["published"] = {
        "min": str(query_date.date()),
        "max": str(next_day.date()),
    }
```

### Multi-Entity Search
Pass multiple entity IDs in a single query to search for an organization AND its domains:

```python
entity_ids = ["B_Gbo", "idn:swedbank.se", "idn:swedbank.com", "idn:swedbank.lt"]
query["reference"]["attributes"] = [
    {"entity": {"id": entity_ids}}
]
```

### Deduplication
RF can return the same reference across different queries. Deduplicate by title or reference ID before storing.

### Response Key Variability
Always check multiple keys — the SDK returns data under `references`, `instances`, or `items` depending on the query type and function used:
```python
data = result.get("references") or result.get("instances") or result.get("items") or []
```

### Error Handling
- The rfapi SDK has built-in retry (3 attempts) for timeouts
- Timeouts are common, especially from cloud deployments — set read timeout to 600s
- Fall back to direct HTTP (`httpx`) for entity search if SDK fails
- Always handle missing fields gracefully — RF responses vary by entity type

### Rate Limits
- Entity resolution: batch up to 100 IDs per query
- Reference queries: 200 per query is safe; use 50 for faster responses
- No hard rate limit documented, but be respectful with concurrent queries
