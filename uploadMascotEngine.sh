# 与 uploadCloudFunction.sh 相同方式部署 mascotEngine；需在环境变量中配置 installPath、envId、projectPath。
${installPath} cloud functions deploy --e ${envId} --n mascotEngine --r --project ${projectPath}
