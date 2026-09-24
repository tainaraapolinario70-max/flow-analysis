/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Gera ficheiros HTML/JS estáticos na pasta /out
  basePath: '/NOME-DO-SEU-REPOSITORIO', // Subpreencha com o nome do repositório do GitHub (se não for a página principal)
  images: {
    unoptimized: true, // Necessário para imagens funcionarem no GitHub Pages
  },
};

export default nextConfig;
