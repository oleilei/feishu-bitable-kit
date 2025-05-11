/**
 * FeishuBitable - 飞书多维表格 CRUD 操作库
 * @version 1.0.5
 * @author oeilei
 * @contact 19131449@qq.com
 * @date 2025-05-12
 * @license MIT
 */
(function (global) {
  "use strict";

  // 自定义错误类
  class FeishuBitableError extends Error {
    constructor(message, code, details) {
      super(message);
      this.name = "FeishuBitableError";
      this.code = code;
      this.details = details;
    }
  }

  // 飞书多维表格数据增删查改功能实现
  class FeishuBitable {
    constructor(appId, appSecret, appToken, tableId) {
      if (!appId || !appSecret || !appToken || !tableId) {
        throw new FeishuBitableError("缺少必要的参数", "INVALID_PARAMS", {
          required: ["appId", "appSecret", "appToken", "tableId"],
        });
      }
      this.appId = appId;
      this.appSecret = appSecret;
      this.appToken = appToken;
      this.tableId = tableId;
      this.baseUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;
      this.accessToken = "";
      this.tokenExpireTime = 0;
      this.retryCount = 3; // 重试次数
      this.retryDelay = 1000; // 重试延迟（毫秒）
    }

    // 封装请求方法
    async makeRequest(url, options, retryCount = 0) {
      try {
        // console.debug(`[FeishuBitable] ${options.method} ${url}`, {
        //   headers: options.headers,
        //   body: options.body
        // });
        return await new Promise((resolve, reject) => {
          // 优先使用 GM_xmlhttpRequest（油猴环境）
          if (typeof GM_xmlhttpRequest !== "undefined") {
            GM_xmlhttpRequest({
              url: url,
              method: options.method || "POST",
              headers: options.headers || {},
              data: options.body,
              timeout: 10000,
              onload: function (response) {
                try {
                  const data = JSON.parse(response.responseText);
                  if (data.code !== 0) {
                    reject(new FeishuBitableError(data.msg || "请求失败", data.code, data));
                  } else {
                    resolve(data);
                  }
                } catch (error) {
                  reject(new FeishuBitableError("解析响应失败", "PARSE_ERROR", error));
                }
              },
              onerror: function (error) {
                reject(new FeishuBitableError("网络请求失败", "NETWORK_ERROR", error));
              },
              ontimeout: function () {
                reject(new FeishuBitableError("请求超时", "TIMEOUT_ERROR"));
              },
            });
          }
          // 其次使用原生 fetch
          else if (typeof fetch !== "undefined") {
            fetch(url, {
              method: options.method || "GET",
              headers: options.headers || {},
              body: options.body,
              timeout: 10000,
            })
              .then((response) => response.json())
              .then((data) => {
                if (data.code !== 0) {
                  reject(new FeishuBitableError(data.msg || "请求失败", data.code, data));
                } else {
                  resolve(data);
                }
              })
              .catch((error) => {
                reject(new FeishuBitableError("网络请求失败", "NETWORK_ERROR", error));
              });
          }
          // 最后使用 XMLHttpRequest
          else {
            const xhr = new XMLHttpRequest();
            xhr.open(options.method || "GET", url);
            xhr.timeout = 10000;

            if (options.headers) {
              Object.keys(options.headers).forEach((key) => {
                xhr.setRequestHeader(key, options.headers[key]);
              });
            }

            xhr.onload = function () {
              try {
                const data = JSON.parse(xhr.responseText);
                if (data.code !== 0) {
                  reject(new FeishuBitableError(data.msg || "请求失败", data.code, data));
                } else {
                  resolve(data);
                }
              } catch (error) {
                reject(new FeishuBitableError("解析响应失败", "PARSE_ERROR", error));
              }
            };
            xhr.onerror = function (error) {
              reject(new FeishuBitableError("网络请求失败", "NETWORK_ERROR", error));
            };
            xhr.ontimeout = function () {
              reject(new FeishuBitableError("请求超时", "TIMEOUT_ERROR"));
            };
            xhr.send(options.body);
          }
        });
      } catch (error) {
        // 重试逻辑
        if (
          retryCount < this.retryCount &&
          (error.message.includes("网络") || error.message.includes("超时"))
        ) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
          return this.makeRequest(url, options, retryCount + 1);
        }
        throw error;
      }
    }

    // 获取访问令牌
    async getAccessToken() {
      // 检查令牌是否存在且未过期
      if (this.accessToken && Date.now() < this.tokenExpireTime - 60 * 1000) {
        return this.accessToken;
      }

      try {
        const response = await this.makeRequest(
          "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              app_id: this.appId,
              app_secret: this.appSecret,
            }),
          }
        );

        this.accessToken = response.tenant_access_token;
        this.tokenExpireTime = Date.now() + response.expire * 1000;
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
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }

    // 查询记录
    async queryRecords(filter = "", pageSize = 10, pageToken = "") {
      try {
        const url = `${this.baseUrl}/search?user_id_type=open_id${
          pageSize ? `&page_size=${pageSize}` : ""
        }${pageToken ? `&page_token=${pageToken}` : ""}`;
        const headers = await this.getHeaders();
        const body = filter
          ? {
              filter: filter,
            }
          : {};

        const response = await this.makeRequest(url, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(body),
        });

        return response.data?.items || [];
      } catch (error) {
        console.error("查询记录出错:", error);
        throw error;
      }
    }

    // 添加记录
    async addRecord(record) {
      if (!record || typeof record !== "object") {
        throw new FeishuBitableError("无效的记录数据", "INVALID_RECORD", {
          record,
        });
      }

      try {
        const headers = await this.getHeaders();
        const response = await this.makeRequest(this.baseUrl, {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            fields: record,
          }),
        });

        return response.data.record.id;
      } catch (error) {
        console.error("添加记录出错:", error);
        throw error;
      }
    }

    // 更新记录
    async updateRecord(recordId, fields) {
      if (!recordId) {
        throw new FeishuBitableError("缺少记录ID", "INVALID_RECORD_ID", {
          recordId,
        });
      }
      if (!fields || typeof fields !== "object") {
        throw new FeishuBitableError("无效的更新数据", "INVALID_FIELDS", {
          fields,
        });
      }

      try {
        const headers = await this.getHeaders();
        const url = `${this.baseUrl}/${recordId}`;

        const response = await this.makeRequest(url, {
          method: "PUT",
          headers: headers,
          body: JSON.stringify({
            fields: fields,
          }),
        });

        return true;
      } catch (error) {
        console.error("更新记录出错:", error);
        throw error;
      }
    }

    // 删除记录
    async deleteRecord(recordId) {
      if (!recordId) {
        throw new FeishuBitableError("缺少记录ID", "INVALID_RECORD_ID", {
          recordId,
        });
      }

      try {
        const headers = await this.getHeaders();
        const url = `${this.baseUrl}/${recordId}`;

        await this.makeRequest(url, {
          method: "DELETE",
          headers: headers,
        });

        return true;
      } catch (error) {
        console.error("删除记录出错:", error);
        throw error;
      }
    }

    // 批量删除记录
    async batchDeleteRecord(recordIds) {
      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        throw new FeishuBitableError("无效的记录ID列表", "INVALID_RECORD_IDS", {
          recordIds,
        });
      }

      try {
        const headers = await this.getHeaders();
        const url = `${this.baseUrl}/batch_delete`;

        await this.makeRequest(url, {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            records: recordIds,
          }),
        });

        return true;
      } catch (error) {
        console.error("批量删除记录出错:", error);
        throw error;
      }
    }

    // 设置重试配置
    setRetryConfig(count, delay) {
      if (typeof count !== "number" || count < 0) {
        throw new FeishuBitableError("无效的重试次数", "INVALID_RETRY_COUNT", {
          count,
        });
      }
      if (typeof delay !== "number" || delay < 0) {
        throw new FeishuBitableError("无效的重试延迟", "INVALID_RETRY_DELAY", {
          delay,
        });
      }
      this.retryCount = count;
      this.retryDelay = delay;
    }
  }

  // 支持多种模块系统
  if (typeof define === "function" && define.amd) {
    // AMD
    define([], function () {
      return FeishuBitable;
    });
  } else if (typeof exports === "object") {
    // CommonJS
    module.exports = FeishuBitable;
  } else {
    // 浏览器全局变量
    global.FeishuBitable = FeishuBitable;
  }
})(typeof window !== "undefined" ? window : this);
