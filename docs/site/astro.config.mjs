import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';

export default defineConfig({
  site: 'https://docs.ttxzone.com',
  integrations: [
    starlight({
      title: 'TTX-Zone',
      logo: {
        light: '../../frontend/src/assets/logos/logo-modo-light.svg',
        dark: '../../frontend/src/assets/logos/logo-modo-dark.svg',
        replacesTitle: true,
      },
      favicon: '/favicon.ico',
      social: [
        { icon: 'github', label: 'Source code', href: 'https://github.com/pasket/ttxzone' },
        { icon: 'external', label: 'Website', href: 'https://ttxzone.com/' },
      ],
      customCss: [
        '@fontsource/ibm-plex-sans/latin-400.css',
        '@fontsource/ibm-plex-sans/latin-500.css',
        '@fontsource/ibm-plex-sans/latin-600.css',
        '@fontsource/ibm-plex-mono/latin-400.css',
        '@fontsource/ibm-plex-mono/latin-500.css',
        './src/styles/tokens.css',
      ],
      routeMiddleware: './src/routeData.ts',
      plugins: [
        // Operation pages are generated, so their links aren't checked here.
        starlightLinksValidator({ exclude: ['/api/**'] }),
        starlightOpenAPI([
          { base: 'api', schema: './schemas/openapi.json', sidebar: { label: 'API reference', collapsed: true } },
        ]),
      ],
      sidebar: [
        {
          label: 'User guide',
          items: [
            'guide/first-exercise',
            'guide/concepts',
            { label: 'Design', items: [{ autogenerate: { directory: 'guide/design' } }] },
            { label: 'Conduct', items: [{ autogenerate: { directory: 'guide/conduct' } }] },
            { label: 'Evaluate', items: [{ autogenerate: { directory: 'guide/evaluate' } }] },
            'guide/improve',
            { label: 'Roles', collapsed: true, items: [{ autogenerate: { directory: 'guide/roles' } }] },
            'guide/administration',
            'guide/preferences',
            'guide/ai-assistant',
            'guide/glossary',
          ],
        },
        { label: 'Instance administration', collapsed: true, items: [{ autogenerate: { directory: 'instance' } }] },
        { label: 'Contributing', collapsed: true, items: [{ autogenerate: { directory: 'contributing' } }] },
        ...openAPISidebarGroups,
      ],
    }),
  ],
});
