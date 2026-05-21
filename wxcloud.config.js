/**
 * 微信云开发 / 云托管 CLI 项目配置（与 project.config.json 的 cloudfunctionRoot 一致）
 * 云函数目录：cloudfunctions/getReply → 开发者工具右键「上传并部署：云端安装依赖」
 */
module.exports = {
  envId: "cloud1-9goe0m7d1d397415",
  functionRoot: "./cloudfunctions",
  functions: [
    {
      name: "getReply",
      path: "getReply",
      installDependency: true,
      timeout: 10,
    },
    {
      name: "quickstartFunctions",
      path: "quickstartFunctions",
      installDependency: true,
    },
    {
      name: "mascotEngine",
      path: "mascotEngine",
      installDependency: true,
    },
  ],
};
