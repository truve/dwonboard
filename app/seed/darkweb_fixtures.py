"""
Realistic mock dark web posts for prototype testing.
Mix of highly relevant (banking), somewhat relevant, and noise items.
Dates are relative to import time (last 7 days).
"""

from datetime import datetime, timedelta, timezone

_now = datetime.now(timezone.utc)


def _days_ago(d: int, h: int = 0) -> datetime:
    return _now - timedelta(days=d, hours=h)


DARKWEB_FIXTURES = [
    # --- HIGH RELEVANCE: Specifically targeting large banks ---
    {
        "source": "exploit_forum",
        "title": "Selling RDP access to major North American bank - 50k+ employees",
        "content": (
            "I have RDP access to internal network of a large North American bank. "
            "Organization has over 50,000 employees and manages approximately $50 billion "
            "in assets. Access includes domain admin on several internal subnets. "
            "Looking for serious buyers only. Price: 15 BTC. Contact via Tox."
        ),
        "author": "dark_access_broker",
        "posted_at": _days_ago(1, 6),
        "item_type": "access_sale",
        "tags": ["banking", "rdp", "network_access", "north_america"],
    },
    {
        "source": "paste_site",
        "title": "Employee credentials dump - US banking sector",
        "content": (
            "Fresh dump of corporate email credentials from a top-20 US bank. "
            "3,200 email:password combinations. Most are @corporate domain. "
            "Includes VPN credentials for remote access. Verified working as of "
            "yesterday. Selling full list for 2 BTC or samples for 0.1 BTC."
        ),
        "author": "cred_dealer_2024",
        "posted_at": _days_ago(2, 3),
        "item_type": "credentials_dump",
        "tags": ["banking", "credentials", "email", "vpn"],
    },
    {
        "source": "ransomware_blog",
        "title": "New victim: Major financial institution - data exfiltrated",
        "content": (
            "We have successfully compromised a major financial services company "
            "headquartered in New York. We have exfiltrated 2.3 TB of data including "
            "customer PII, internal financial records, board meeting minutes, and "
            "M&A documentation. The organization operates in wealth management and "
            "commercial banking across North America. They have 72 hours to negotiate "
            "before we begin publishing data."
        ),
        "author": "lockbit_affiliate",
        "posted_at": _days_ago(0, 12),
        "item_type": "ransomware_listing",
        "tags": ["ransomware", "financial", "data_exfiltration", "new_york"],
    },
    {
        "source": "dark_forum",
        "title": "Database leak - banking customers PII",
        "content": (
            "Obtained database backup from a large retail bank. Contains 1.2M customer "
            "records: full names, SSNs, account numbers, transaction history from 2020-2024. "
            "Bank operates branches across the eastern United States. Selling complete "
            "database for 5 BTC. Sample available."
        ),
        "author": "db_dumper",
        "posted_at": _days_ago(3, 8),
        "item_type": "data_leak",
        "tags": ["banking", "database", "pii", "customer_data"],
    },
    {
        "source": "exploit_forum",
        "title": "0day in Citrix NetScaler - banking sector targeted",
        "content": (
            "Discovered a pre-auth RCE in Citrix NetScaler ADC (CVE pending). "
            "Affects versions 13.1 and 14.1. Already used to gain foothold in "
            "3 financial institutions. Banking sector heavily uses this product. "
            "Selling exploit for 20 BTC or per-use access for 3 BTC."
        ),
        "author": "zero_day_vendor",
        "posted_at": _days_ago(4, 2),
        "item_type": "vulnerability",
        "tags": ["0day", "citrix", "banking", "exploit"],
    },
    # --- MEDIUM RELEVANCE: Industry-adjacent, could apply ---
    {
        "source": "dark_forum",
        "title": "Corporate VPN credentials - financial services",
        "content": (
            "Batch of Pulse Secure VPN credentials from various financial services "
            "companies. ~500 credential pairs from multiple organizations. Mix of "
            "investment banks, insurance companies, and fintech. Most US-based. "
            "Not sorted by org. Selling full batch for 1 BTC."
        ),
        "author": "vpn_hunter",
        "posted_at": _days_ago(2, 15),
        "item_type": "credentials_dump",
        "tags": ["vpn", "financial", "credentials", "pulse_secure"],
    },
    {
        "source": "dark_market",
        "title": "Fresh SSN+DOB fullz - bank customers",
        "content": (
            "20,000 fresh fullz with SSN, DOB, address, phone, email. Sourced from "
            "multiple banking institutions across the US. High-income individuals, "
            "average account balance >$100k. Perfect for synthetic identity fraud. "
            "$15 per fullz, bulk discounts available."
        ),
        "author": "fullz_king",
        "posted_at": _days_ago(1, 20),
        "item_type": "data_leak",
        "tags": ["fullz", "ssn", "banking", "identity"],
    },
    {
        "source": "telegram_channel",
        "title": "Wire transfer fraud kit - targets US banks",
        "content": (
            "Complete wire transfer fraud kit targeting major US banks. Includes "
            "social engineering scripts for bank call centers, fake authorization "
            "letter templates, and SWIFT message manipulation tools. Works with "
            "banks using legacy SWIFT infrastructure. $2,000 for complete kit."
        ),
        "author": "fraud_tools_shop",
        "posted_at": _days_ago(5, 4),
        "item_type": "other",
        "tags": ["fraud", "wire_transfer", "swift", "banking"],
    },
    {
        "source": "exploit_forum",
        "title": "AWS keys leaked from financial sector GitHub repos",
        "content": (
            "Scraped GitHub and found AWS access keys from several financial sector "
            "companies. Some still active. Includes S3 bucket access with customer "
            "data. Sorted by company size. Interested parties DM me for pricing."
        ),
        "author": "cloud_scraper",
        "posted_at": _days_ago(3, 12),
        "item_type": "data_leak",
        "tags": ["aws", "cloud", "financial", "github", "keys"],
    },
    {
        "source": "dark_forum",
        "title": "Insider access - compliance department major bank",
        "content": (
            "I work in the compliance department of a large US commercial bank. "
            "I can provide SAR reports, KYC documentation, and internal audit findings. "
            "Have access to data on suspicious transaction monitoring thresholds. "
            "Serious inquiries only, payment via Monero."
        ),
        "author": "insider_threat_001",
        "posted_at": _days_ago(1, 8),
        "item_type": "access_sale",
        "tags": ["insider", "compliance", "banking", "sar"],
    },
    # --- LOW RELEVANCE: General cybercrime, less banking-specific ---
    {
        "source": "dark_market",
        "title": "Phishing kit - Office 365 enterprise",
        "content": (
            "Advanced O365 phishing kit with real-time token capture. Bypasses MFA "
            "using Evilginx2 proxy. Custom landing pages for enterprise targets. "
            "Includes Microsoft Teams integration for lateral movement. $500 per kit."
        ),
        "author": "phish_pro",
        "posted_at": _days_ago(2, 7),
        "item_type": "other",
        "tags": ["phishing", "o365", "mfa_bypass"],
    },
    {
        "source": "exploit_forum",
        "title": "SQL injection on e-commerce platform",
        "content": (
            "Found blind SQL injection on a popular e-commerce SaaS platform. "
            "Affects all tenants. Can dump customer databases including payment info. "
            "Looking for partnership to monetize. Platform has ~10k merchants."
        ),
        "author": "sqli_master",
        "posted_at": _days_ago(4, 18),
        "item_type": "vulnerability",
        "tags": ["sqli", "ecommerce", "payment_data"],
    },
    {
        "source": "paste_site",
        "title": "Leaked employee list - tech company",
        "content": (
            "Full employee directory from a mid-size tech company in San Francisco. "
            "Includes names, titles, email addresses, phone numbers, Slack handles. "
            "1,800 employees. Useful for social engineering campaigns."
        ),
        "author": "data_miner",
        "posted_at": _days_ago(5, 10),
        "item_type": "data_leak",
        "tags": ["employee_data", "tech", "san_francisco"],
    },
    {
        "source": "dark_forum",
        "title": "Healthcare records for sale - 500k patients",
        "content": (
            "Massive healthcare data breach. 500k patient records with full medical "
            "history, insurance info, SSNs. From a hospital network in the Midwest. "
            "Selling full database for 10 BTC."
        ),
        "author": "health_data_broker",
        "posted_at": _days_ago(3, 5),
        "item_type": "data_leak",
        "tags": ["healthcare", "hipaa", "patient_data"],
    },
    {
        "source": "ransomware_blog",
        "title": "Manufacturing company encrypted - 30 days countdown",
        "content": (
            "Successfully encrypted all systems at a German manufacturing company. "
            "Annual revenue ~$200M. Exfiltrated trade secrets, engineering drawings, "
            "and ERP data. Countdown to publication: 30 days."
        ),
        "author": "blackcat_affiliate",
        "posted_at": _days_ago(6, 3),
        "item_type": "ransomware_listing",
        "tags": ["ransomware", "manufacturing", "germany"],
    },
    {
        "source": "dark_market",
        "title": "Stolen credit cards - US banks",
        "content": (
            "10,000 freshly skimmed credit card numbers from US ATMs. Mix of Visa and "
            "Mastercard. All have CVV and ZIP. Cards from major US banks. Valid rate >80%. "
            "$20 per card, $5,000 for full batch."
        ),
        "author": "card_vendor_usa",
        "posted_at": _days_ago(1, 14),
        "item_type": "credentials_dump",
        "tags": ["credit_cards", "skimming", "atm", "banking"],
    },
    {
        "source": "telegram_channel",
        "title": "DDoS-for-hire targeting financial APIs",
        "content": (
            "Offering DDoS services specifically targeting financial sector APIs. "
            "Can sustain 500Gbps for 24 hours. Previous targets include payment "
            "processors, trading platforms, and banking APIs. $1,000 per attack."
        ),
        "author": "ddos_kingpin",
        "posted_at": _days_ago(4, 9),
        "item_type": "other",
        "tags": ["ddos", "financial", "api"],
    },
    {
        "source": "exploit_forum",
        "title": "Log4Shell still works on banking Java apps",
        "content": (
            "Scanned external-facing Java applications at 200+ banks. Found 47 still "
            "vulnerable to Log4Shell (CVE-2021-44228). List includes IP addresses and "
            "confirmed RCE. Selling per-target access or full list."
        ),
        "author": "java_hunter",
        "posted_at": _days_ago(2, 22),
        "item_type": "vulnerability",
        "tags": ["log4shell", "java", "banking", "rce"],
    },
    # --- NOISE: Clearly unrelated ---
    {
        "source": "dark_forum",
        "title": "Netflix/Spotify/Disney+ account generator",
        "content": (
            "Automated tool to generate premium streaming accounts. Works with Netflix, "
            "Spotify, Disney+, HBO Max. Unlimited accounts. $50 for lifetime access "
            "to the generator tool."
        ),
        "author": "stream_accounts",
        "posted_at": _days_ago(1, 3),
        "item_type": "other",
        "tags": ["streaming", "accounts", "generator"],
    },
    {
        "source": "dark_market",
        "title": "Counterfeit documents - EU passports",
        "content": (
            "High quality counterfeit EU passports and ID cards. Germany, France, "
            "Netherlands, Italy available. Pass UV and RFID checks. Starting at $3,000. "
            "Processing time: 2 weeks."
        ),
        "author": "doc_forge",
        "posted_at": _days_ago(5, 16),
        "item_type": "other",
        "tags": ["counterfeit", "documents", "passport"],
    },
    {
        "source": "dark_forum",
        "title": "Malware development tutorial - RAT builder",
        "content": (
            "Comprehensive tutorial on building a Remote Access Trojan from scratch. "
            "C++ codebase, includes persistence, keylogging, screen capture, and "
            "encrypted C2 communication. 50 page PDF guide. Free download."
        ),
        "author": "malware_teacher",
        "posted_at": _days_ago(6, 8),
        "item_type": "other",
        "tags": ["malware", "rat", "tutorial"],
    },
    {
        "source": "paste_site",
        "title": "Crypto wallet drainer script",
        "content": (
            "JavaScript-based crypto wallet drainer. Targets MetaMask, Trust Wallet, "
            "and Phantom. Deploys via malicious airdrop claim pages. Includes hosting "
            "setup guide. $300 for the complete package."
        ),
        "author": "crypto_drainer",
        "posted_at": _days_ago(3, 11),
        "item_type": "other",
        "tags": ["crypto", "drainer", "javascript"],
    },
    {
        "source": "dark_forum",
        "title": "SIM swap service - US carriers",
        "content": (
            "Offering SIM swap services for all major US carriers. T-Mobile, AT&T, "
            "Verizon. Turnaround time: 30 minutes. $500 per swap. Used for bypassing "
            "SMS 2FA. High success rate."
        ),
        "author": "sim_swapper",
        "posted_at": _days_ago(2, 19),
        "item_type": "other",
        "tags": ["sim_swap", "2fa_bypass", "telecom"],
    },
    # --- MORE BANKING-RELEVANT: Various threat levels ---
    {
        "source": "dark_forum",
        "title": "Discussion: Best methods to target wealth management firms",
        "content": (
            "Thread discussing effective attack vectors against wealth management "
            "and private banking firms. Key insights: most use outdated CRM systems, "
            "relationship managers often have broad access, and client communication "
            "channels are poorly secured. Several members claiming active operations "
            "against top-50 US wealth managers."
        ),
        "author": "fin_threat_actor",
        "posted_at": _days_ago(2, 1),
        "item_type": "other",
        "tags": ["wealth_management", "banking", "attack_planning"],
    },
    {
        "source": "exploit_forum",
        "title": "SWIFT system access - looking for cashout partners",
        "content": (
            "Have persistent access to SWIFT messaging system at a mid-size bank. "
            "Can initiate wire transfers up to $10M per transaction. Need experienced "
            "cashout team with mule network. 60/40 split. Serious inquiries only, "
            "references required."
        ),
        "author": "swift_operator",
        "posted_at": _days_ago(0, 8),
        "item_type": "access_sale",
        "tags": ["swift", "banking", "wire_fraud", "cashout"],
    },
    {
        "source": "dark_forum",
        "title": "Board member email access - Fortune 500 financial firm",
        "content": (
            "Compromised email account of a board member at a Fortune 500 financial "
            "services company. Access to confidential board materials, M&A discussions, "
            "and strategic planning documents. Selling access for 8 BTC. Company is "
            "a top asset manager with operations in North America and Europe."
        ),
        "author": "executive_access",
        "posted_at": _days_ago(1, 16),
        "item_type": "access_sale",
        "tags": ["executive", "email", "financial", "fortune500"],
    },
    {
        "source": "paste_site",
        "title": "API keys and internal endpoints - fintech companies",
        "content": (
            "Collected API keys and internal service endpoints from 12 fintech companies. "
            "Includes payment processing APIs, KYC verification endpoints, and internal "
            "dashboards. Some have hardcoded admin credentials. List available for 0.5 BTC."
        ),
        "author": "api_collector",
        "posted_at": _days_ago(4, 14),
        "item_type": "data_leak",
        "tags": ["api_keys", "fintech", "endpoints", "credentials"],
    },
    {
        "source": "ransomware_blog",
        "title": "Insurance company data publication - round 1",
        "content": (
            "Publishing first batch of data from a US insurance company that refused "
            "to pay ransom. Batch includes policyholder data, claims history, and "
            "internal financial statements. More batches to follow weekly."
        ),
        "author": "clop_affiliate",
        "posted_at": _days_ago(5, 7),
        "item_type": "ransomware_listing",
        "tags": ["ransomware", "insurance", "data_publication"],
    },
    {
        "source": "dark_forum",
        "title": "Recruiting: Insiders at US banks needed",
        "content": (
            "Looking for insiders at major US banks. Positions of interest: IT admin, "
            "wire transfer operations, compliance officers, branch managers. "
            "Compensation: $50k-200k depending on access level and usefulness. "
            "Contact via encrypted channel."
        ),
        "author": "recruiter_dark",
        "posted_at": _days_ago(3, 2),
        "item_type": "other",
        "tags": ["insider_recruitment", "banking", "corruption"],
    },
    {
        "source": "exploit_forum",
        "title": "Bypass for bank fraud detection systems",
        "content": (
            "Developed a technique to bypass transaction monitoring at banks using "
            "Actimize and FICO Falcon. Works by structuring transactions to stay below "
            "ML model thresholds. Whitepaper and tooling available for 3 BTC. "
            "Tested against 5 major US banks successfully."
        ),
        "author": "fraud_bypass",
        "posted_at": _days_ago(2, 11),
        "item_type": "other",
        "tags": ["fraud", "detection_bypass", "banking", "ml"],
    },
    # --- MORE NOISE ---
    {
        "source": "dark_market",
        "title": "Bulk email lists - 100M verified addresses",
        "content": (
            "100 million verified email addresses sorted by country and industry. "
            "Spam-ready, includes corporate and personal emails. $200 for full list. "
            "Updated monthly."
        ),
        "author": "spam_lists",
        "posted_at": _days_ago(4, 6),
        "item_type": "data_leak",
        "tags": ["email", "spam", "bulk_data"],
    },
    {
        "source": "dark_forum",
        "title": "WordPress exploit pack - 50 plugins",
        "content": (
            "Collection of 50 working WordPress plugin exploits. Includes SQLi, RCE, "
            "and auth bypass for popular plugins. Automated scanner included. "
            "$100 for the complete pack."
        ),
        "author": "wp_hacker",
        "posted_at": _days_ago(6, 12),
        "item_type": "vulnerability",
        "tags": ["wordpress", "plugins", "exploits"],
    },
    {
        "source": "telegram_channel",
        "title": "Carding tutorial 2024 - complete guide",
        "content": (
            "Updated guide for carding in 2024. Covers: selecting cards, choosing "
            "targets, antidetect browsers, residential proxies, delivery addresses. "
            "Focus on electronics and luxury goods. Free 200-page PDF."
        ),
        "author": "card_school",
        "posted_at": _days_ago(5, 22),
        "item_type": "other",
        "tags": ["carding", "tutorial", "fraud"],
    },
    {
        "source": "dark_market",
        "title": "Ransomware-as-a-Service - new affiliate program",
        "content": (
            "Launching new RaaS platform. Features: fast encryption (AES-256 + RSA-4096), "
            "cross-platform (Windows/Linux/ESXi), automated data exfiltration, "
            "DLS portal, 24/7 support. 80/20 split in favor of affiliates. "
            "Now recruiting experienced operators."
        ),
        "author": "new_raas_group",
        "posted_at": _days_ago(1, 5),
        "item_type": "other",
        "tags": ["raas", "ransomware", "affiliate"],
    },
    {
        "source": "dark_forum",
        "title": "Vulnerabilities in mobile banking apps",
        "content": (
            "Research paper on common vulnerabilities in mobile banking applications. "
            "Analyzed 30 apps from top US banks. Common findings: certificate pinning "
            "bypasses, insecure local storage, weak biometric implementation, "
            "and API endpoint exposure. Detailed technical writeup with PoC."
        ),
        "author": "mobile_researcher",
        "posted_at": _days_ago(3, 17),
        "item_type": "vulnerability",
        "tags": ["mobile", "banking", "vulnerabilities", "research"],
    },
    {
        "source": "paste_site",
        "title": "Leaked source code - banking middleware",
        "content": (
            "Source code from a banking middleware vendor. Includes payment processing "
            "modules, SWIFT integration code, and ACH processing logic. Contains "
            "hardcoded test credentials that may work in production. 50MB archive."
        ),
        "author": "source_leaker",
        "posted_at": _days_ago(4, 20),
        "item_type": "data_leak",
        "tags": ["source_code", "banking", "middleware", "swift"],
    },
    {
        "source": "exploit_forum",
        "title": "Social engineering playbook - bank call centers",
        "content": (
            "Comprehensive social engineering playbook for targeting bank call centers. "
            "Includes pretexting scenarios, verification bypass techniques, and recorded "
            "example calls. Specifically designed for US retail banks. $300."
        ),
        "author": "se_expert",
        "posted_at": _days_ago(6, 1),
        "item_type": "other",
        "tags": ["social_engineering", "banking", "call_center"],
    },
    # --- A FEW MORE HIGH-RELEVANCE ITEMS ---
    {
        "source": "dark_forum",
        "title": "Selling customer data from a large commercial bank",
        "content": (
            "I have a fresh database from a large US commercial bank. Contains 800k "
            "business customer records including: company name, EIN, authorized signers, "
            "account balances, credit lines, and contact information. Bank has a strong "
            "presence on the East Coast with approximately 40,000-60,000 employees. "
            "Premium data, pricing starts at 8 BTC."
        ),
        "author": "data_broker_elite",
        "posted_at": _days_ago(0, 20),
        "item_type": "data_leak",
        "tags": ["banking", "commercial", "customer_data", "east_coast"],
    },
    {
        "source": "exploit_forum",
        "title": "Active campaign targeting C-suite at financial institutions",
        "content": (
            "Our group is running a targeted campaign against C-suite executives at "
            "major US financial institutions. Using custom spear-phishing with AI-generated "
            "content. Already compromised CFO accounts at 3 banks. Current target list "
            "includes top 30 US banks by assets. Looking for collaboration."
        ),
        "author": "apt_finance",
        "posted_at": _days_ago(1, 2),
        "item_type": "other",
        "tags": ["apt", "spearphishing", "c-suite", "banking", "targeted"],
    },
    {
        "source": "dark_forum",
        "title": "Cryptocurrency exchange hack discussion",
        "content": (
            "Discussing recent vulnerability found in a major crypto exchange's hot "
            "wallet infrastructure. Potential to drain funds from custodial accounts. "
            "Not related to traditional banking. Looking for smart contract auditors "
            "to verify the exploit path."
        ),
        "author": "defi_hacker",
        "posted_at": _days_ago(2, 5),
        "item_type": "vulnerability",
        "tags": ["crypto", "exchange", "smart_contract"],
    },
    {
        "source": "telegram_channel",
        "title": "Government contractor email dump",
        "content": (
            "Dumped 15,000 emails from a US government defense contractor. Contains "
            "classified project discussions, personnel security clearance data, and "
            "contract negotiations. Selling for 20 BTC."
        ),
        "author": "gov_leaks",
        "posted_at": _days_ago(4, 1),
        "item_type": "data_leak",
        "tags": ["government", "contractor", "classified", "defense"],
    },
    {
        "source": "dark_market",
        "title": "Botnet for rent - 100k nodes",
        "content": (
            "Renting access to our botnet: 100,000 compromised devices worldwide. "
            "Mix of IoT devices, home routers, and Windows PCs. Use cases: DDoS, "
            "proxy network, credential stuffing. Starting at $500/day."
        ),
        "author": "botnet_rental",
        "posted_at": _days_ago(5, 14),
        "item_type": "other",
        "tags": ["botnet", "ddos", "proxy"],
    },
    {
        "source": "dark_forum",
        "title": "Retail company POS malware deployment",
        "content": (
            "Successfully deployed POS malware across 200+ retail locations of a "
            "national clothing chain. Skimming card data in real-time. Already collected "
            "50k cards in first week. Looking for carders to monetize."
        ),
        "author": "pos_operator",
        "posted_at": _days_ago(3, 9),
        "item_type": "credentials_dump",
        "tags": ["pos", "retail", "skimming", "credit_cards"],
    },
    {
        "source": "exploit_forum",
        "title": "Zero-day in Oracle FLEXCUBE banking platform",
        "content": (
            "Found critical vulnerability in Oracle FLEXCUBE Universal Banking v14.x. "
            "Pre-auth SQL injection leading to full database access. Many banks in "
            "Asia and Middle East use this platform. Exploit available for 25 BTC."
        ),
        "author": "oracle_bug_hunter",
        "posted_at": _days_ago(2, 16),
        "item_type": "vulnerability",
        "tags": ["oracle", "flexcube", "banking", "sqli", "0day"],
    },
    {
        "source": "dark_forum",
        "title": "Phishing domains registered for major banks",
        "content": (
            "Registered lookalike domains for 15 major US and European banks. "
            "All with valid SSL certificates. Ready for phishing campaigns. "
            "Includes pre-built landing pages matching current bank websites. "
            "Selling individual domains for 0.05 BTC each."
        ),
        "author": "domain_squatter",
        "posted_at": _days_ago(1, 11),
        "item_type": "other",
        "tags": ["phishing", "domains", "banking", "ssl"],
    },
]
