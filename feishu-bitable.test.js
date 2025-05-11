/**
 * FeishuBitable 单元测试
 * @jest-environment node
 */

const FeishuBitable = require('./feishu-bitable');

// 模拟 fetch
global.fetch = jest.fn();

// 模拟 GM_xmlhttpRequest
global.GM_xmlhttpRequest = jest.fn();

// 模拟 XMLHttpRequest
class MockXMLHttpRequest {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.ontimeout = null;
    this.open = jest.fn();
    this.send = jest.fn();
    this.setRequestHeader = jest.fn();
  }
}
global.XMLHttpRequest = MockXMLHttpRequest;

describe('FeishuBitable', () => {
  let bitable;
  const mockConfig = {
    appId: 'test_app_id',
    appSecret: 'test_app_secret',
    appToken: 'test_app_token',
    tableId: 'test_table_id'
  };

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 创建新的实例
    bitable = new FeishuBitable(
      mockConfig.appId,
      mockConfig.appSecret,
      mockConfig.appToken,
      mockConfig.tableId
    );
  });

  describe('构造函数', () => {
    test('应该正确初始化实例', () => {
      expect(bitable.appId).toBe(mockConfig.appId);
      expect(bitable.appSecret).toBe(mockConfig.appSecret);
      expect(bitable.appToken).toBe(mockConfig.appToken);
      expect(bitable.tableId).toBe(mockConfig.tableId);
      expect(bitable.baseUrl).toContain(mockConfig.appToken);
      expect(bitable.baseUrl).toContain(mockConfig.tableId);
    });

    test('缺少必要参数时应该抛出错误', () => {
      expect(() => new FeishuBitable()).toThrow('缺少必要的参数');
      expect(() => new FeishuBitable(mockConfig.appId)).toThrow('缺少必要的参数');
    });
  });

  describe('getAccessToken', () => {
    test('应该正确获取访问令牌', async () => {
      const mockToken = 'test_token';
      const mockExpire = 7200;
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          code: 0,
          tenant_access_token: mockToken,
          expire: mockExpire
        })
      });

      const token = await bitable.getAccessToken();
      expect(token).toBe(mockToken);
      expect(bitable.accessToken).toBe(mockToken);
      expect(bitable.tokenExpireTime).toBeGreaterThan(Date.now());
    });

    test('令牌未过期时应该返回缓存的令牌', async () => {
      const mockToken = 'test_token';
      bitable.accessToken = mockToken;
      bitable.tokenExpireTime = Date.now() + 3600000; // 1小时后过期

      const token = await bitable.getAccessToken();
      expect(token).toBe(mockToken);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('queryRecords', () => {
    test('应该正确查询记录', async () => {
      const mockRecords = [{ id: '1', fields: { name: 'test' } }];
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          code: 0,
          data: { items: mockRecords }
        })
      });

      const records = await bitable.queryRecords();
      expect(records).toEqual(mockRecords);
    });

    test('应该正确处理分页参数', async () => {
      const pageSize = 20;
      const pageToken = 'next_page_token';
      
      await bitable.queryRecords('', pageSize, pageToken);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`page_size=${pageSize}`),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`page_token=${pageToken}`),
        expect.any(Object)
      );
    });
  });

  describe('addRecord', () => {
    test('应该正确添加记录', async () => {
      const mockRecord = { name: 'test' };
      const mockRecordId = 'new_record_id';
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          code: 0,
          data: { record: { id: mockRecordId } }
        })
      });

      const recordId = await bitable.addRecord(mockRecord);
      expect(recordId).toBe(mockRecordId);
    });

    test('无效记录数据时应该抛出错误', async () => {
      await expect(bitable.addRecord(null)).rejects.toThrow('无效的记录数据');
      await expect(bitable.addRecord('invalid')).rejects.toThrow('无效的记录数据');
    });
  });

  describe('updateRecord', () => {
    test('应该正确更新记录', async () => {
      const recordId = 'test_record_id';
      const fields = { name: 'updated' };
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ code: 0 })
      });

      const result = await bitable.updateRecord(recordId, fields);
      expect(result).toBe(true);
    });

    test('缺少记录ID时应该抛出错误', async () => {
      await expect(bitable.updateRecord(null, {})).rejects.toThrow('缺少记录ID');
    });
  });

  describe('deleteRecord', () => {
    test('应该正确删除记录', async () => {
      const recordId = 'test_record_id';
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ code: 0 })
      });

      const result = await bitable.deleteRecord(recordId);
      expect(result).toBe(true);
    });

    test('缺少记录ID时应该抛出错误', async () => {
      await expect(bitable.deleteRecord(null)).rejects.toThrow('缺少记录ID');
    });
  });

  describe('batchDeleteRecord', () => {
    test('应该正确批量删除记录', async () => {
      const recordIds = ['1', '2', '3'];
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ code: 0 })
      });

      const result = await bitable.batchDeleteRecord(recordIds);
      expect(result).toBe(true);
    });

    test('无效记录ID列表时应该抛出错误', async () => {
      await expect(bitable.batchDeleteRecord(null)).rejects.toThrow('无效的记录ID列表');
      await expect(bitable.batchDeleteRecord([])).rejects.toThrow('无效的记录ID列表');
    });
  });

  describe('setRetryConfig', () => {
    test('应该正确设置重试配置', () => {
      const count = 5;
      const delay = 2000;
      
      bitable.setRetryConfig(count, delay);
      expect(bitable.retryCount).toBe(count);
      expect(bitable.retryDelay).toBe(delay);
    });

    test('无效的重试次数应该抛出错误', () => {
      expect(() => bitable.setRetryConfig(-1, 1000)).toThrow('无效的重试次数');
      expect(() => bitable.setRetryConfig('invalid', 1000)).toThrow('无效的重试次数');
    });

    test('无效的重试延迟应该抛出错误', () => {
      expect(() => bitable.setRetryConfig(3, -1)).toThrow('无效的重试延迟');
      expect(() => bitable.setRetryConfig(3, 'invalid')).toThrow('无效的重试延迟');
    });
  });
}); 