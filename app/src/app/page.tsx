import Client from './client';
import type { AppConfig } from '@/types/config';
import { getConfig } from '@/lib/config';

async function Page() {
  const config = getConfig();

  return <Content config={config} />;
}

function Content({ config }: { config: AppConfig }) {
  return <Client initialConfig={config} />;
}

export default Page;
