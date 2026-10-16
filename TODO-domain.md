# Custom domain — later

The site is published at https://primetimeplayer.github.io/signal-tech/. Do these steps when a custom domain is chosen. This note does not pick a domain.

1. At the registrar, add DNS for the domain you chose.
   - Apex: `A` records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`.
   - `www`: a `CNAME` to `primetimeplayer.github.io`.
2. In the GitHub repository, open Settings, then Pages, then Custom domain. Enter the domain. After the DNS check succeeds, turn on Enforce HTTPS.
3. If Pages publishes the `public/` folder, commit a `public/CNAME` file that contains only the domain so the next deploy keeps it.
4. Replace `https://primetimeplayer.github.io/signal-tech/` in canonical links, `og:url`, `twitter:url`, JSON-LD `url` and `@id` values, and every `<loc>` in `public/sitemap.xml`.
5. `public/site.webmanifest` uses relative `start_url` and `scope` (`./`). Leave those unless the site is served from a subpath.
6. Reload a shared link and confirm the preview image still resolves. Point `og:image` and `twitter:image` at the same host as the canonical URL if the image should move with the domain.
