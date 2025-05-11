# FeishuBitable

飞书多维表格 CRUD 操作库

## 安装

、、、bash
npm run build  

uglifyjs feishu-bitable.js -c -m -o 1.0.1/feishu-bitable.min.js
、、、

### 通过 CDN 使用

```html
<script src="https://oss.techclub.plus/dict/feishu-bitable.min.js"></script>
```

### 通过 npm 安装

```bash
npm install feishu-bitable
```

## 使用方法

### 浏览器环境

```javascript
// 创建实例
const bitable = new FeishuBitable(
  'your_app_id',
  'your_app_secret',
  'your_app_token',
  'your_table_id'
);

// 查询记录
const records = await bitable.queryRecords();

// 添加记录
const recordId = await bitable.addRecord({
  name: '测试记录',
  value: 100
});

// 更新记录
await bitable.updateRecord(recordId, {
  name: '更新后的记录'
});

// 删除记录
await bitable.deleteRecord(recordId);

// 批量删除记录
await bitable.batchDeleteRecord(['id1', 'id2', 'id3']);

// 配置重试
bitable.setRetryConfig(5, 2000); // 重试5次，每次间隔2秒
```

### Node.js 环境

```javascript
const FeishuBitable = require('feishu-bitable');

const bitable = new FeishuBitable(
  'your_app_id',
  'your_app_secret',
  'your_app_token',
  'your_table_id'
);

// 使用方式与浏览器环境相同
```

### Tampermonkey 环境

```javascript
// @require https://oss.techclub.plus/dict/feishu-bitable.min.js

const bitable = new FeishuBitable(
  'your_app_id',
  'your_app_secret',
  'your_app_token',
  'your_table_id'
);

// 使用方式与浏览器环境相同
```

## API 文档

### 构造函数

```javascript
new FeishuBitable(appId, appSecret, appToken, tableId)
```

### 方法

- `queryRecords(filter = '', pageSize = 10, pageToken = '')`: 查询记录
- `addRecord(record)`: 添加记录
- `updateRecord(recordId, fields)`: 更新记录
- `deleteRecord(recordId)`: 删除记录
- `batchDeleteRecord(recordIds)`: 批量删除记录
- `setRetryConfig(count, delay)`: 设置重试配置

## 错误处理

所有方法都会在出错时抛出异常，建议使用 try-catch 进行错误处理：

```javascript
try {
  const records = await bitable.queryRecords();
} catch (error) {
  console.error('操作失败:', error);
}
```

## 许可证

MIT
