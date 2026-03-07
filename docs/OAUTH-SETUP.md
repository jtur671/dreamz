# OAuth Provider Setup

These env vars are referenced in `supabase/config.toml` and need to be in your `.env` file to silence the warnings:

```
SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```

---

## Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Application type: **Web application**
6. Add authorized redirect URI:
   ```
   https://vjqvxraqeptgmbxnipqo.supabase.co/auth/v1/callback
   ```
7. Copy the **Client ID** and **Client Secret** and add them to your `.env`:

```env
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<your-google-client-secret>
```

> You also need to set these in the Supabase Dashboard under **Authentication > Providers > Google**.

---

## Apple Sign In

### 1. Create an App ID (if not done)

1. Go to [Apple Developer > Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)
2. Click **Identifiers > +**
3. Select **App IDs**, continue
4. Enable **Sign In with Apple** capability
5. Register with your bundle ID (`com.dreamzjournal.app`)

### 2. Create a Services ID

1. Go to **Identifiers > +**
2. Select **Services IDs**, continue
3. Give it a description (e.g. "Dreamz Web Auth") and an identifier (e.g. `com.dreamzjournal.auth`)
4. Enable **Sign In with Apple**, click **Configure**
5. Set the domain and return URL:
   - Domain: `vjqvxraqeptgmbxnipqo.supabase.co`
   - Return URL: `https://vjqvxraqeptgmbxnipqo.supabase.co/auth/v1/callback`
6. Save. The **Services ID identifier** is your `CLIENT_ID`.

```env
SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID=com.dreamzjournal.auth
```

### 3. Create a Private Key

1. Go to **Keys > +**
2. Name it (e.g. "Dreamz Sign In Key")
3. Enable **Sign In with Apple**, click **Configure**
4. Select your primary App ID
5. Register and **download the `.p8` file** (you only get one download)
6. Note the **Key ID** shown on the confirmation page

### 4. Generate the Secret

Apple's secret is a signed JWT. You need three values:
- **Key ID** (from step 3)
- **Team ID** (top right of Apple Developer portal, 10-char alphanumeric)
- **Private key** (contents of the `.p8` file)

Generate the JWT secret using this Ruby script (or equivalent):

```ruby
require "jwt"

key_file = "AuthKey_XXXXXXXXXX.p8"
team_id = "YOUR_TEAM_ID"
client_id = "com.dreamzjournal.auth"
key_id = "XXXXXXXXXX"

ecdsa_key = OpenSSL::PKey::EC.new(File.read(key_file))

headers = { "kid" => key_id }
claims = {
  "iss" => team_id,
  "iat" => Time.now.to_i,
  "exp" => Time.now.to_i + 86400 * 180, # 6 months max
  "aud" => "https://appleid.apple.com",
  "sub" => client_id
}

token = JWT.encode(claims, ecdsa_key, "ES256", headers)
puts token
```

Or use [this online generator](https://developer.apple.com/account/resources/authkeys/list) and the Supabase docs.

```env
SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIs...
```

> You also need to set these in the Supabase Dashboard under **Authentication > Providers > Apple**.

> **Important for native iOS:** When using `signInWithIdToken` (native Apple Sign-In via `expo-apple-authentication`), the Supabase Apple provider **Client ID** must be set to the app's **bundle identifier** (`com.dreamzjournal.app`), not the Services ID. The Services ID is only needed for web-based OAuth flows.

---

## After Setup

Add all four values to your `.env`:

```env
SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID=com.dreamzjournal.auth
SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=eyJhbGciOiJFUzI1Ni...
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=GOCSPX-xxxxxxxxxxxxx
```

The Supabase CLI warnings will stop once these are set.
