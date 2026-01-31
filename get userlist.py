import requests
import time
import json

# --- 配置区 ---
# 目标站点 API 地址
API_URL = "https://www.qiuwenbaike.cn/w/api.php"
# 排除分类名称（需带前缀）
EXCLUDE_CATEGORY = "Category:求闻百科维护脚本"
# 规范的 User-Agent：<客户端名称>/<版本> (<联系方式>) <核心库>/<版本>
CONTACT_INFO = "mailto:zorua@vip.qq.com"
USER_AGENT = f"Qiuwen/1.1 QiuwenMassMessageGenerator/1.2 ({CONTACT_INFO}) Python-requests/{requests.__version__}"

class QiuwenMassMessageListGenerator:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.excluded_users = set()

    def _fetch_api(self, params):
        """通用 API 请求方法，处理基础错误逻辑"""
        try:
            response = self.session.get(API_URL, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"API 请求失败: {e}")
            return None

    def get_category_members(self):
        """获取特定分类下的用户，用于后续排除"""
        print(f"正在获取分类 {EXCLUDE_CATEGORY} 的成员...")
        params = {
            "action": "query",
            "format": "json",
            "list": "categorymembers",
            "cmtitle": EXCLUDE_CATEGORY,
            "cmnamespace": 2,  # 仅限 User 命名空间
            "cmlimit": "max"
        }
        
        while True:
            data = self._fetch_api(params)
            if not data: break
            
            members = data.get("query", {}).get("categorymembers", [])
            for m in members:
                # 提取用户名（去掉 "User:" 前缀）
                username = m["title"].split(":", 1)[1] if ":" in m["title"] else m["title"]
                self.excluded_users.add(username)
            
            if "continue" in data:
                params.update(data["continue"])
            else:
                break
        print(f"分类排除名单获取完成，共 {len(self.excluded_users)} 人。")

    def generate_delivery_list(self):
        """枚举全站用户并执行多重过滤"""
        self.get_category_members()
        
        print("开始获取全站用户并执行过滤...")
        params = {
            "action": "query",
            "format": "json",
            "list": "allusers",
            "auexcludegroup": "bot",  # 排除机器人组
            "auprop": "blockinfo|groups", # 获取封禁状态和权限组
            "aulimit": "max"
        }
        
        final_list = []
        count_all = 0
        count_filtered = 0

        while True:
            data = self._fetch_api(params)
            if not data: break
            
            users = data.get("query", {}).get("allusers", [])
            for user in users:
                count_all += 1
                name = user["name"]
                
                # 1. 过滤被封禁用户 (检查是否存在 blockid)
                if "blockid" in user:
                    continue
                
                # 2. 再次确认权限组（双重保险排除 bot）
                if "bot" in user.get("groups",):
                    continue
                
                # 3. 过滤特定分类成员
                if name in self.excluded_users:
                    continue
                
                # 4. 格式化为 MassMessage 目标语法
                final_list.append({"title": f"User talk:{name}"})
                count_filtered += 1
            
            if "continue" in data:
                params.update(data["continue"])
                # 适当节流，保护服务器资源
                time.sleep(0.2)
            else:
                break
        
        print(f"\n处理完成！")
        print(f"全站注册用户数（非机器人）: {count_all}")
        print(f"符合条件的目标用户数: {count_filtered}")
        return final_list

if __name__ == "__main__":
    generator = QiuwenMassMessageListGenerator()
    delivery_list = generator.generate_delivery_list()
    
    # 将结果保存为 JSON 文件，以便 MassMessage 使用
    output_file = "massmessage_list.json"
    result_data = {
        "description": "{{DISPLAYTITLE|《求闻》订阅列表}}{{/header}}[[Category:《求闻》]]<!-- \n请各位将自己的用户讨论页/接收页面放在页面的最下方，另起一行，谢谢！--><!-- \n請各位將自己的用戶討論頁/接收頁面放在頁面的最下方，另起一行，謝謝！-->",
        "targets": delivery_list
    }
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result_data, f, ensure_ascii=False, indent=4)
    
    print(f"发送列表已生成至: {output_file}")