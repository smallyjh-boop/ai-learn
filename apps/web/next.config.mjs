/** @type {import('next').NextConfig} */
const nextConfig = {
  // 共享包是 TS 源码，需要 Next 来编译
  transpilePackages: ["@ai-learn/shared"],
  // Docker 部署（NAS）用
  output: "standalone",
};

export default nextConfig;
