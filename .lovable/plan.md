

# World-Class Email Hub -- Smart, Personalized, Secure

## What Changes

Your email panel gets a complete redesign with AI-powered intelligence that goes far beyond basic sync. Every email is analyzed for safety, relevance, and required action -- personalized to you, your contacts, and your work context.

## Key Upgrades

### 1. AI-Powered Email Analysis (Backend)
Upgrade the `gmail-sync` edge function with a richer AI prompt that analyzes each email for:
- **Spam detection** -- flags suspicious patterns, unknown bulk senders
- **Phishing detection** -- checks for spoofed domains, urgency manipulation, suspicious links
- **Content summary** -- one-line AI summary of what the email actually needs from you
- **Sentiment** -- is this positive, neutral, urgent, or concerning?
- **Suggested action** -- "Reply needed", "Just FYI", "Can ignore", "Review attachment"

The AI receives your contact list context and profile info (business roles, company names) so it knows what's relevant to you personally.

### 2. New Database Fields
Add columns to `user_emails` for the new AI analysis:
- `ai_summary` (text) -- one-line AI summary
- `ai_suggested_action` (text) -- what you should do
- `is_spam` (boolean) -- AI spam flag
- `is_phishing` (boolean) -- AI phishing flag  
- `threat_reason` (text) -- why it was flagged
- `sentiment` (text) -- positive/neutral/urgent/warning

### 3. Redesigned Email Panel (UI)
A clean, minimalist interface with smart grouping:

**Smart Sections (not just filter tabs):**
- **Needs Your Attention** -- action required emails from known contacts, sorted by priority
- **FYI** -- informational emails you should see but don't need to act on
- **Newsletters & Promotions** -- auto-grouped, collapsed by default
- **Flagged** -- spam/phishing warnings with clear visual indicators

**Each Email Card shows:**
- Sender avatar (initials or contact photo)
- AI-generated one-line summary instead of raw snippet
- Priority indicator based on contact tier
- Suggested action chip ("Reply", "Review", "FYI")
- Threat badge if spam/phishing detected

**Email Detail Sheet upgrades:**
- AI summary section at top with suggested action
- Phishing/spam warning banner if flagged (red alert with reason)
- Contact card link if sender is a known contact
- "Open in Gmail" button remains for full access
- Quick actions: Archive, Mark Important, Report Spam

### 4. Personalization Context
The AI prompt includes:
- Your name and roles (Medieval Empires, OYA Play, Eleven Labs)
- Your contact list with tiers so it knows who matters most
- Domain matching (emails from company domains get business priority)

### 5. Filter Tabs Redesign
Replace current tabs with cleaner segmentation:
- **Smart Inbox** (default) -- AI-curated view, important first
- **All** -- everything chronologically
- **Flagged** -- spam/phishing alerts

## Technical Plan

### Files to Modify

**`supabase/functions/gmail-sync/index.ts`**
- Expand AI categorization prompt to include spam/phishing detection, summary generation, sentiment analysis, and suggested actions
- Pass user profile context (name, companies) and contact names to the AI
- Add new tool-call schema with fields: category, priority_boost, summary, suggested_action, is_spam, is_phishing, threat_reason, sentiment
- Store all new fields in the database

**`src/hooks/useEmails.ts`**
- Update Email interface with new fields (ai_summary, ai_suggested_action, is_spam, is_phishing, threat_reason, sentiment)
- Add `reportSpam` action that archives + marks as spam
- Update filter logic: "smart" view groups by sections, "flagged" shows threats
- Add `markAsRead` function

**`src/components/email/EmailPanel.tsx`**
- Complete redesign with section-based layout (Needs Attention, FYI, Low Priority)
- New filter tabs: Smart Inbox, All, Flagged
- Section headers with counts
- Empty states per section
- Pull-to-refresh support

**`src/components/email/EmailCard.tsx`**
- Show AI summary instead of raw snippet
- Add suggested action chip
- Threat warning badge for spam/phishing
- Sender initials avatar with contact-tier color coding
- Swipe-to-archive gesture support

**`src/components/email/EmailDetailSheet.tsx`**
- AI analysis section at top (summary + suggested action)
- Phishing/spam warning banner with threat reason
- Contact link if matched
- Report spam button
- Mark as read on open

### Database Migration
Add new columns to `user_emails`:
```text
ai_summary        TEXT
ai_suggested_action TEXT
is_spam           BOOLEAN DEFAULT false
is_phishing       BOOLEAN DEFAULT false
threat_reason     TEXT
sentiment         TEXT DEFAULT 'neutral'
```

### AI Prompt Design
The upgraded prompt gives the AI your personal context:
- "You are analyzing emails for Asad, who runs Medieval Empires, OYA Play, and Eleven Labs"
- Contact list with tiers so it knows family vs business vs unknown
- Checks for phishing indicators: mismatched domains, urgency language, suspicious URLs
- Returns structured data via tool calling for reliable parsing

