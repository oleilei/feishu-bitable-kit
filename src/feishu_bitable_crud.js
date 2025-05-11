// 飞书多维表格数据增删查改功能实现
class FeishuBitable {
  constructor(appId, appSecret, appToken, tableId) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.appToken = appToken;
    this.tableId = tableId;
    this.baseUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;
    this.accessToken = "";
    this.tokenExpireTime = 0;
  }

  // 获取访问令牌
  async getAccessToken() {
    // 检查令牌是否存在且未过期
    if (this.accessToken && Date.now() < this.tokenExpireTime - 60 * 1000) {
      return this.accessToken;
    }

    try {
      const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            app_id: this.appId,
            app_secret: this.appSecret,
          })
      });

      if (!response.ok) {
        throw new Error(`获取访问令牌失败: ${response.status}`);
      }

      const data = await response.json();
      if (data.code !== 0) {
        throw new Error(`获取访问令牌失败: ${data.msg}`);
      }

      this.accessToken = data.tenant_access_token;
      this.tokenExpireTime = Date.now() + data.expire * 1000;
      return this.accessToken;
    } catch (error) {
      console.error("获取访问令牌出错:", error);
      throw error;
    }
  }

  // 获取请求头
  async getHeaders() {
    const token = await this.getAccessToken();
    return {
      'Content-Type': 'application/json',
       Authorization: `Bearer ${token}`,
    };
  }

  // 查询记录
  async queryRecords(filter = '', pageSize = 10, pageToken = '') {
    try {
      const url = `${this.baseUrl}/search?user_id_type=open_id${pageSize ? `&page_size=${pageSize}` : ""}${pageToken ? `&page_token=${pageToken}` : ""}`;
      // console.debug('请求的url', url);
      const headers = await this.getHeaders();
      const body = filter ? {
        filter: filter
      } : {};
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`查询失败: ${response.status}`);
      }
      const result = await response.json();
      if (result.code !== 0) {
        throw new Error(`查询失败: ${result.msg}`);
      }
      return result.data?.items || [];
    } catch (error) {
      console.error("查询记录出错:", error);
      throw error;
    }
  }

  // 添加记录
  async addRecord(record) {
    try {
      const headers = await this.getHeaders();
      const body = JSON.stringify({
        fields: record,
      });
      // console.log(body);
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: headers,
        body: body,
      });

      if (!response.ok) {
        throw new Error(`添加失败: ${response.status}`);
      }
      const data = await response.json();
      return data.data.record.id;
    } catch (error) {
      console.error("添加记录出错:", error);
      throw error;
    }
  }

  // 更新记录
  async updateRecord(recordId, fields) {
    try {
      const headers = await this.getHeaders();
      const url = `${this.baseUrl}/${recordId}`;
      const body = JSON.stringify({
        fields: fields,
      });

      const response = await fetch(url, {
        method: "PUT",
        headers: headers,
        body: body,
      });

      if (!response.ok) {
        throw new Error(`更新失败: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("更新记录出错:", error);
      throw error;
    }
  }

  // 删除记录
  async deleteRecord(recordId) {
    try {
      const headers = await this.getHeaders();
      const url = `${this.baseUrl}/${recordId}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`删除失败: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("删除记录出错:", error);
      throw error;
    }
  }

  // 批量删除记录
  async batchDeleteRecord(recordIds) {
    try {
      const headers = await this.getHeaders();
      const url = `${this.baseUrl}/batch_delete`;

      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          record_ids: recordIds
        })
      });

      if (!response.ok) {
        throw new Error(`批量删除失败: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("批量删除记录出错:", error);
      throw error;
    }
  }
}

// 使用示例
async function exampleUsage() {
  // 替换为你的应用ID、应用令牌和表格ID
  const bitable = new FeishuBitable(
    "your_app_id",
    "your_app_secret",
    "your_app_token",
    "your_table_id"
  );

  try {
    // 添加记录
    const newRecordId = await bitable.addRecord({
      姓名: "张三",
      年龄: 30,
      职位: "工程师",
    });
    console.log("新增记录ID:", newRecordId);

    // 查询记录
    const records = await bitable.queryRecords("Age > 25");
    console.log("查询结果:", records);

    // 更新记录
    const updateSuccess = await bitable.updateRecord(newRecordId, {
      年龄: 31,
    });
    console.log("更新成功:", updateSuccess);

    // 删除记录
    const deleteSuccess = await bitable.deleteRecord(newRecordId);
    console.log("删除成功:", deleteSuccess);
  } catch (error) {
    console.error("操作失败:", error);
  }
}

// 运行示例（需要在支持async/await的环境中）
// exampleUsage();
