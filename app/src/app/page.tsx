import { getConfig } from '@/lib/config';
import type { AppConfig } from '@/types/config';
import Client from './client';

// Disable caching to always read fresh config from file
export const dynamic = 'force-dynamic';

async function Page() {
  const config = getConfig();

  return <Content config={config} />;
}

function Content({ config }: { config: AppConfig }) {
  return <Client initialConfig={config} />;
}

export default Page;
