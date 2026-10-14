# ListyPosts setup

1. Supabase SQL editor: run, in order, any of these you have not run yet:
   009_listymarket.sql, 010_fix_reviews_view.sql, 011_social_posts.sql, 012_agent_posts.sql
   (all in supabase/migrations; each is safe to run twice).
2. Copy `.env.example` to `.env.local` (next to package.json) and fill in:
   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   (ANTHROPIC_API_KEY optional). Never put VITE_ in front of the service key.
3. `npm install` then `npm run dev`.
4. Vercel: add the same server variables, then redeploy.

Pages
- /                      Agent / Customer gateway
- /agents                Original ListyAI landing page
- /market                ListyMarket: request box + live properties
- /market/posts          Agent posts feed with a message box under every post
- /market/listing/:id    Listing page, enquiry form, report
- /market/agent/:id      Agent page with reviews
- /dashboard/publish     Publish hub (ListyMarket, Facebook, Instagram, TikTok)
- /dashboard/buyer-requests, /dashboard/reviews
