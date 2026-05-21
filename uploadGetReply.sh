#!/usr/bin/env bash
# 与 uploadCloudFunction.sh / uploadMascotEngine.sh 相同方式部署 getReply
# 使用前在环境中设置：installPath、envId、projectPath
# 示例 installPath 为微信开发者工具 cli 所在目录
"${installPath}" cloud functions deploy --e "${envId}" --n getReply --r --project "${projectPath}"
