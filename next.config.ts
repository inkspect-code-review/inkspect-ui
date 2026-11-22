import type { NextConfig } from 'next';
const nextConfig: NextConfig = {output:'standalone', poweredByHeader:false, transpilePackages:["@inkspect/core"], env:{NEXT_PUBLIC_UI_VERSION:process.env.INKSPECT_VERSION||'ui'},
 async rewrites(){const origin=process.env.INKSPECT_API_ORIGIN||'http://127.0.0.1:3003';return ["account/devices","account/notifications","repositories","reviews","review-settings","byok","knowledge","workspace-chat","members","invitation","usage","realtime/auth","realtime/test","webhooks/github"].map(route=>({source:'/api/'+route,destination:origin+'/api/'+route}));}
};export default nextConfig;
