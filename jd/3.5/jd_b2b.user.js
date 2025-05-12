// ==UserScript==
// @name         京东万商|图片批量采集
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  获取京东万商的主图和详情图片，商品信息保存到飞书表格
// @author       oleilei
// @match        *://b2b.jd.com/goods/goods-detail/*
// @require      https://cdn.bootcdn.net/ajax/libs/jszip/3.9.1/jszip.min.js
// @require      https://cdn.bootcdn.net/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @require      https://oss.techclub.plus/dict/1.0.9/feishu-bitable.min.js
// @iconURL      https://storage.jd.com/retail-mobile/pc-b2b/index/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      open.feishu.cn
// @connect      storage.jd.com
// @connect      360buyimg.com
// @connect      oss.techclub.plus
// ==/UserScript==

(function () {
  "use strict";

  const GOODS_INFO_FIELDS = [
    "商品编码", "UPC", "商品名称", "一级类目", "二级类目", "采购价", 
    "预计到手价", "预计采购数量", "促销优惠", "购买数量提示", "规格", 
    "包装规格", "包装", "包装清单", "与UPC数量关系", "建议零售价", 
    "销售单位价格", "销售单位", "生产日期", "保质期", "品牌", "产地", 
    "原料成分", "只数", "净含量", "推荐", "材质", "服务保障", "配送", 
    "产地直发", "商品链接", "图片地址", "个数", "分类", "毛重", "适用空间", 
    "国产/进口", "供应商"
  ];

  // 调试日志函数
  function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[京东万商图片下载器 ${timestamp}] ${message}`;

    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }

  // 创建样式
  function createGlobalStyle(css) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  }

  // 创建下载按钮
  function createDownloadButton() {
    const button = document.createElement("button");
    button.textContent = "";
    button.style.cssText = `
            position: fixed;
            top: 100px;
            right: 10px;
            z-index: 9999;
            width: 32px;
            height: 32px;
            padding: 0;
            background-color: transparent;
            border: none;
            cursor: move;
            user-select: none;
            touch-action: none;
            transform: translate3d(0, 0, 0);
            background-image: url('https://storage.jd.com/retail-mobile/pc-b2b/index/favicon.ico');
            background-size: contain;
            background-position: center;
            background-repeat: no-repeat;
            transition: transform 0.2s ease;
        `;

    // 创建提示框
    const tooltip = document.createElement("div");
    tooltip.textContent = "鸡哥续杯！放心大胆的摁我！";
    tooltip.style.cssText = `
            position: absolute;
            right: 100%;
            top: 50%;
            transform: translateY(-50%);
            margin-right: 10px;
            padding: 6px 12px;
            background-color: #000;
            color: #fff;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s ease, visibility 0.2s ease;
            pointer-events: none;
            z-index: 10000;
        `;
    button.appendChild(tooltip);

    // 添加焦点事件
    button.addEventListener("mouseenter", () => {
      if (!button.disabled) {
        tooltip.style.opacity = "1";
        tooltip.style.visibility = "visible";
      }
    });

    button.addEventListener("mouseleave", () => {
      if (!button.disabled) {
        tooltip.style.opacity = "0";
        tooltip.style.visibility = "hidden";
      }
    });

    // 添加悬停效果
    button.addEventListener("mouseover", () => {
      if (!button.disabled) {
        button.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(1.1)`;
      }
    });
    button.addEventListener("mouseout", () => {
      if (!button.disabled) {
        button.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(1)`;
      }
    });

    // 添加拖拽功能
    let isDragging = false;
    let startTime = 0;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    let hasMoved = false;

    function dragStart(e) {
      startTime = Date.now();
      hasMoved = false;
      if (e.type === "mousedown") {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
      } else {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
      }

      if (e.target === button) {
        isDragging = true;
      }
    }

    function dragEnd(e) {
      const endTime = Date.now();
      const dragDuration = endTime - startTime;

      // 如果拖动时间小于200ms且没有移动，则认为是点击
      if (dragDuration < 200 && !hasMoved) {
        isDragging = false;
      } else {
        // 拖动结束，更新位置
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();

        if (e.type === "mousemove") {
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
        } else {
          currentX = e.touches[0].clientX - initialX;
          currentY = e.touches[0].clientY - initialY;
        }

        xOffset = currentX;
        yOffset = currentY;

        // 检查是否发生了移动
        if (Math.abs(xOffset) > 5 || Math.abs(yOffset) > 5) {
          hasMoved = true;
        }

        // 确保按钮不会超出视窗边界
        const buttonRect = button.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (currentX < 0) currentX = 0;
        if (currentY < 0) currentY = 0;
        if (currentX + buttonRect.width > viewportWidth) currentX = viewportWidth - buttonRect.width;
        if (currentY + buttonRect.height > viewportHeight) currentY = viewportHeight - buttonRect.height;

        setTranslate(currentX, currentY, button);
      }
    }

    function setTranslate(xPos, yPos, el) {
      el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    // 添加事件监听器
    button.addEventListener("mousedown", dragStart, false);
    document.addEventListener("mousemove", drag, false);
    document.addEventListener("mouseup", dragEnd, false);

    // 触摸事件支持
    button.addEventListener("touchstart", dragStart, false);
    document.addEventListener("touchmove", drag, false);
    document.addEventListener("touchend", dragEnd, false);

    // 点击事件处理
    button.addEventListener("click", async (e) => {
      if (isDragging || hasMoved) {
        e.preventDefault();
        return;
      }
      debugLog("下载按钮被点击");
      
      // 禁用按钮并显示下载中状态
      button.disabled = true;
      button.classList.add("disabled-button");
      tooltip.textContent = "下载中...";
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "visible";

      try {
        const mainImageUrls = getAllMainImageUrls();
        const detailImageUrls = getAllDetailImageUrls();
        await saveImgZip(mainImageUrls, detailImageUrls);
        
        // 下载成功
        tooltip.textContent = "下载完成！";
        setTimeout(() => {
          tooltip.style.opacity = "0";
          tooltip.style.visibility = "hidden";
          tooltip.textContent = "鸡哥续杯！放心大胆的摁我！";
          button.disabled = false;
          button.classList.remove("disabled-button");
        }, 1000);
      } catch (error) {
        // 下载失败
        tooltip.textContent = "下载失败！";
        setTimeout(() => {
          tooltip.style.opacity = "0";
          tooltip.style.visibility = "hidden";
          tooltip.textContent = "鸡哥续杯！放心大胆的摁我！";
          button.disabled = false;
          button.classList.remove("disabled-button");
        }, 1000);
      }
    });

    document.body.appendChild(button);
    return button;
  }

  // 获取商品主图URL
  function getAllMainImageUrls() {
    debugLog("开始扫描商品主图");
    let main_div_list = document.getElementsByClassName("goodsdetail-image__bottom__list")[0];
    let mail_item_list = main_div_list.getElementsByClassName("goodsdetail-image__bottom__list__item");
    let main_imgs = [];
    //获取所有主图链接
    for (var item of mail_item_list) {
      main_imgs.push(item.getElementsByTagName("img")[0].currentSrc);
    }

    //处理主图链接
    // 源：https://m.360buyimg.com/n4/s300x300_jfs/t1/63699/26/18934/579578/62985b83E909005cc/d7d414bf1f760565.jpg!q70!cc_300x300.webp
    // 目标：https://m.360buyimg.com/n1/s800x800_jfs/t1/63699/26/18934/579578/62985b83E909005cc/d7d414bf1f760565.jpg.webp
    // https://m.360buyimg.com/n4/s300x300_jfs/t1/165516/23/27927/49030/632ac293Ebdb4f125/9f2ebda62782299e.jpg!q70!cc_300x300.webp
    // https://m.360buyimg.com/n1/s800x800_jfs/t1/165516/23/27927/49030/632ac293Ebdb4f125/9f2ebda62782299e.jpg.webp
    // https://img11.360buyimg.com/imagetools/jfs/t1/138998/39/36045/6291/649d4fd5Fc974a4bd/6ac53ba83280e7d4.png.webp

    let main_final = [];
    for (let url of main_imgs) {
      let urll = url;
      if (urll.includes("!q70!cc_300x300.webp")) {
        urll = url.substring(0, url.length - 20);
      }
      if (urll.includes("/n4/s300x300_jfs/")) {
        urll = urll.replace("/n4/s300x300_jfs/", "/n1/s800x800_jfs/");
      }
      console.log("处理后主图地址：" + urll);
      main_final.push(urll);
    }

    debugLog(`找到 ${main_final.length} 个主图元素`);
    return main_final;
  }

  // 获取商品详情图URL
  function getAllDetailImageUrls() {
    debugLog("开始扫描商品详情图");
    //获取所有详情图
    let detail_imgs = [];
    let detail_wrap = document.getElementById("shadowHost").getElementsByClassName("ssd-module-wrap")[0];
    if (detail_wrap) {
      let detail_list = detail_wrap.getElementsByTagName("div");
      for (var i of detail_list) {
        let raw = window.getComputedStyle(i).backgroundImage;
        raw = raw.slice(5);
        raw = raw.substring(0, raw.length - 2);
        if (raw == "") {
          continue;
        }
        detail_imgs.push(raw);
      }
    } else {
      let imgs = document.getElementById("shadowHost").getElementsByTagName("img");
      for (var img of imgs) {
        detail_imgs.push(img.currentSrc);
      }
    }

    if (detail_imgs.length == 0) {
      //获取所有详情图（京东页面数据获取有的时候会改变，写两个保证获取）
      let raw = document.getElementsByClassName("ssd-module-wrap");
      raw = raw[raw.length - 1].getElementsByTagName("div");
      for (var m of raw) {
        let raw = window.getComputedStyle(m).backgroundImage;
        raw = raw.slice(5);
        raw = raw.substring(0, raw.length - 2);
        if (raw == "") {
          continue;
        }
        detail_imgs.push(raw);
      }
    }

    //处理详情图链接
    //源：https://img30.360buyimg.com/sku/jfs/t1/219606/1/27883/85451/643f9cacFb091e10e/de6e431e331228ad.jpg
    let detail_final = [];
    for (let url of detail_imgs) {
      let urll = url;
      if (urll.includes("avif")) {
        urll = url.substring(0, url.length - 5);
      }
      if (urll.includes("/n5/s54x54_jfs/")) {
        urll = urll.replace("/n5/s54x54_jfs/", "/n1/s450x450_jfs/");
      }
      if (urll.includes("/n5/jfs/")) {
        urll = urll.replace("/n5/jfs/", "/n1/jfs/");
      }
      if (urll.includes("s114x114_jfs")) {
        urll = urll.replace("s114x114_jfs", "s800x800_jfs");
      }
      console.log("处理后详情图地址：" + urll);
      detail_final.push(urll);
    }

    debugLog(`找到 ${detail_final.length} 个详情图元素`);
    return detail_final;
  }

  // 图片打包下载，支持主图和详情图
  async function saveImgZip(mainImgArr, detailImgArr) {
    const startTime = Date.now();
    let feishuTime = 0;
    let downloadTime = 0;

    if (mainImgArr.length === 0 && detailImgArr.length === 0) {
      debugLog("未找到任何图片URL");
      return;
    }

    debugLog(`准备下载 ${mainImgArr.length} 张主图和 ${detailImgArr.length} 张详情图`);

    // 获取商品信息
    const goods_info = getGoodsInfo();

    // 校验商品编码和UPC
    const goods_code = goods_info["商品编码"];
    if (!goods_code) {
      debugLog("错误：商品编码不存在，尝试刷新页面重试");
      // 检查是否已经重试过
      const retryCount = window._retryCount || 0;
      if (retryCount < 2) {
        window._retryCount = retryCount + 1;
        debugLog(`第 ${retryCount + 1} 次重试，刷新页面...`);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        debugLog("已达到最大重试次数(2次)，请手动刷新页面后重试");
        window._retryCount = 0; // 重置重试计数
      }
      return;
    }

    // 重置重试计数
    window._retryCount = 0;

    // 先存入飞书表格
    const feishuStartTime = Date.now();
    try {
      await saveToFeishu(goods_info);
      feishuTime = (Date.now() - feishuStartTime) / 1000;
      debugLog(`商品信息已成功保存到飞书表格，用时: ${feishuTime.toFixed(2)}秒`);
    } catch (error) {
      debugLog("保存到飞书表格失败:", error);
      return;
    }

    const goods_name = goods_info["商品名称"];
    const file_name = goods_code + "_" + goods_name.replace(/\//g, "-");
    debugLog(`生成文件名: ${file_name}`);

    // 创建一个包含所有图片的数组
    const allImages = [
      ...mainImgArr.map((url, index) => ({ url, type: 'main', index })),
      ...detailImgArr.map((url, index) => ({ url, type: 'detail', index }))
    ];

    debugLog(`总共需要处理 ${allImages.length} 张图片`);

    const downloadStartTime = Date.now();
    try {
      // 使用 Promise.all 并行下载所有图片
      debugLog("开始并行下载所有图片...");
      const images = await Promise.all(allImages.map(img => {
        debugLog(`开始下载图片 ${img.type}-${img.index + 1}: ${img.url}`);
        return new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: 'GET',
            url: img.url,
            responseType: 'blob',
            headers: {
              'Referer': 'https://b2b.jd.com/',
              'Origin': 'https://b2b.jd.com'
            },
            onload: function(response) {
              if (response.status === 200) {
                debugLog(`图片 ${img.type}-${img.index + 1} 下载成功，大小: ${(response.response.size / 1024).toFixed(2)}KB`);
                resolve({
                  type: img.type,
                  index: img.index,
                  blob: response.response
                });
              } else {
                debugLog(`图片 ${img.type}-${img.index + 1} 下载失败，状态码: ${response.status}`);
                reject(new Error(`HTTP ${response.status}`));
              }
            },
            onerror: function(error) {
              debugLog(`图片 ${img.type}-${img.index + 1} 下载失败:`, error);
              reject(error);
            }
          });
        });
      }));

      debugLog(`成功下载 ${images.length} 张图片`);

      // 创建 JSZip 实例
      const zip = new JSZip();
      
      // 创建文件夹
      const mainFolder = zip.folder("主图");
      const detailFolder = zip.folder("详情图");
      
      // 添加商品信息
      zip.file("商品信息.json", JSON.stringify(goods_info));
      
      // 添加图片到对应的文件夹
      debugLog("开始添加图片到ZIP");
      images.forEach(img => {
        const folder = img.type === 'main' ? mainFolder : detailFolder;
        // 获取图片后缀
        let url = allImages[img.index].url;
        let suffix = ".jpg";
        let match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
        if (match) {
          suffix = "." + match[1].split("?")[0];
        }
        const fileName = `${goods_code}-${img.index + 1}${suffix}`;
        // debugLog(`添加图片到ZIP: ${fileName}`);
        folder.file(fileName, img.blob);
      });
      // debugLog("所有图片添加完成");
      
      // 生成 ZIP 文件
      /**
       * STORE：仅存储文件，不压缩（ZIP 体积大，但处理速度快），对于已经压缩过的文件（如 JPEG、PNG），使用 "STORE" 避免浪费计算资源
       * DEFLATE：使用 DEFLATE 算法压缩（ZIP 体积小，但需要更多计算资源），对于文本文件或可压缩数据，推荐使用 "DEFLATE"
       */
      debugLog("开始生成ZIP文件");
      await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6 // 压缩级别，1-9，1为最快，9为最小文件大小
        }
      }).then(content => {
        debugLog(`ZIP文件生成成功，大小: ${(content.size / 1024).toFixed(2)}KB`);
        debugLog("开始下载ZIP文件");

        // 优先使用 GM_download
        if (typeof GM_download !== "undefined") {
          const downloadUrl = URL.createObjectURL(content);
          GM_download({
            url: downloadUrl,
            name: `${file_name}.zip`,
            saveAs: true,
            onload: function() {
              debugLog("ZIP文件下载完成");
              URL.revokeObjectURL(downloadUrl);
              downloadTime = (Date.now() - downloadStartTime) / 1000;
              const totalTime = (Date.now() - startTime) / 1000;
              debugLog(`下载和打包用时: ${downloadTime.toFixed(2)}秒`);
              debugLog(`总用时: ${totalTime.toFixed(2)}秒`);
            },
            onerror: function(error) {
              debugLog("GM_download失败，尝试使用saveAs:", error);
              // 如果 GM_download 失败，使用 saveAs
              try {
                saveAs(content, `${file_name}.zip`);
                downloadTime = (Date.now() - downloadStartTime) / 1000;
                const totalTime = (Date.now() - startTime) / 1000;
                debugLog(`下载和打包用时: ${downloadTime.toFixed(2)}秒`);
                debugLog(`总用时: ${totalTime.toFixed(2)}秒`);
              } catch (saveError) {
                debugLog("saveAs也失败了:", saveError);
              }
            }
          });
        } else {
          // 如果没有 GM_download，直接使用 saveAs
          try {
            saveAs(content, `${file_name}.zip`);
            downloadTime = (Date.now() - downloadStartTime) / 1000;
            const totalTime = (Date.now() - startTime) / 1000;
            debugLog(`下载和打包用时: ${downloadTime.toFixed(2)}秒`);
            debugLog(`总用时: ${totalTime.toFixed(2)}秒`);
          } catch (error) {
            debugLog("saveAs失败:", error);
          }
        }
      }).catch(error => {
        debugLog("ZIP生成失败:", error);
      });
    } catch (err) {
      debugLog("处理图片时出错:", err);
      debugLog("错误详情:", {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    }
  }

  // 获取商品信息
  function getGoodsInfo() {
    /**
     * 安全获取DOM元素文本内容
     * @param {string} selector - CSS选择器
     * @param {Element} parent - 可选的父元素，默认为document
     * @return {string} 元素文本内容或空字符串
     */
    function getElementText(selector, parent = document) {
      const element = parent.querySelector(selector);
      return element?.textContent?.trim() || "";
    }

    /**
     * 从字符串中提取数字价格
     * @param {string} priceText - 包含价格的字符串
     * @returns {string} 提取的数字价格
     */
    function convertPrice(priceText) {
      const price = String(priceText).replace(/[^\d.-]/g, "").trim();
      return Number(price);
    }

    /**
     * 从字符串中提取数字
     * @param {string} text - 包含数字的字符串
     * @returns {string} 提取的数字
     */
    function convertNumber(text) {
      return String(text).replace(/[^\d]/g, "").trim();
    }

    // 商品链接
    const url = window.location.href;
    console.log(`商品链接: ${url}`);

    // 分类/导航栏
    const first_cate = getElementText(".shopbreadcrumb__normal");
    const last_cate = getElementText(".shopbreadcrumb__last");
    console.log(`分类/导航栏: ${first_cate} - ${last_cate}`);

    // 获取供应商
    const supplier = getElementText(".goodsdetail-breadcrumb > .shop-detail > .title");
    console.log(`供应商: ${supplier}`);

    // 商品名称
    const goods_name = getElementText("title");
    console.log(`商品名称: ${goods_name}`);

    // 采购价
    let price_purchase = getElementText(".purchase-item");
    price_purchase = convertPrice(price_purchase);
    console.log(`采购价: ${price_purchase}`);

    // 预计到手价
    let predict_purchase_price = getElementText(".purchase-price");
    predict_purchase_price = convertPrice(predict_purchase_price);
    console.log(`预计到手价: ${predict_purchase_price}`);

    // 预计采购数量，采购价后面的
    const predict_purchase_num = getElementText(".purchase-num");
    console.log(`预计采购数量: ${predict_purchase_num}`);

    // 促销优惠，多个
    const coupon_items = document.getElementsByClassName("shop-label shop-label--coupons primary large couponlabel coupon-label-item");
    let coupons = [];
    for (const item of coupon_items) {
      const coupon = getElementText(".name", item);
      coupons.push(coupon);
    }
    const promotion_active = getElementText(".promotion-active-item");
    if (promotion_active?.length > 0) {
      // 定义正则表达式，用于匹配满赠活动模式
      const regex = /满\d+元即赠[^，]+(，赠完即止)?/g;
      const actives = promotion_active.match(regex) || [];
      coupons.push(...actives);
    }
    console.log(`促销优惠: ${coupons}`);

    // 服务保障
    const service_guarantee = getElementText(".service-hover.rcd-tooltip__trigger.rcd-tooltip__trigger");
    console.log(`服务保障: ${service_guarantee}`);

    // 配送
    const delivery = getElementText(".goodsdetail-addr > .flex.bottom > div:nth-child(2)");
    console.log(`配送: ${delivery}`);

    // 购买数量提示
    const sku_count_item = document.getElementsByClassName("shop-sku-count__message")[0];
    const sku_count = getElementText(".business-tips .active", sku_count_item);
    console.log(`购买数量提示: ${sku_count}`);

    // 产地直发
    const warehouse = getElementText(".goods-detail-warehouse__container");
    console.log(`产地直发: ${warehouse}`);

    // 商品参数
    let detail_parameters = new Map();
    let main_parameter_items = document.getElementsByClassName("goodsdetail-parameter")[0];
    main_parameter_items = main_parameter_items?.getElementsByClassName("right__item");
    if (main_parameter_items) {
      for (let item of main_parameter_items) {
        let value = getElementText(".right__item-top", item);
        let name = getElementText(".right__item-bottom", item);
        console.log(`商品参数: ${name} - ${value}`);
        detail_parameters.set(name, value);
      }
    }

    // 商品详情参数
    let detail_parameter_items = document.getElementsByClassName("desc__content__introduce__textContent__text");
    // let detail_parameters = new Map();
    for (let item of detail_parameter_items) {
      let description = getElementText("span", item);
      console.log(`商品详情参数: ${description}`);
      let array = description?.split(": ");
      let name = array[0] ? array[0] : "";
      let value = array[1] ? array[1] : "";
      // console.log(`商品详情参数: ${name} - ${value}`);
      if (name === "最小可售单位UPC") {
        name = "UPC";
        value = value ? convertNumber(value) : "";
      } else if (name === "本品与最小可售单位数量关系") {
        name = "与UPC数量关系";
      } else if (name.match(/规格\((.+?)\)/g)) {
        name = "规格";
      } else if (name === "推荐") {
        value = value?.split(",");
      } else if(name === "包装单位") {
        name = "包装";
      }

      detail_parameters.set(name, value);
    }
    // 包装清单
    let package_list = getElementText(".desc__content__specification__package");
    console.log(`包装清单: ${package_list}`);

    const goods_info = {
        "商品名称": goods_name,
        "商品链接": url,
        "一级类目": first_cate,
        "二级类目": last_cate,
        "供应商": supplier,
        "采购价": price_purchase,
        "预计到手价": predict_purchase_price,
        "预计采购数量": predict_purchase_num,
        "促销优惠": coupons,
        "服务保障": service_guarantee,
        "配送": delivery,
        "购买数量提示": sku_count,
        "产地直发": warehouse,
        "包装清单": package_list,
        ...Object.fromEntries(detail_parameters)
    };

    // 处理数值类型的字段
    const keywords = ["金额", "到手价", "采购价", "销售单位价格", "建议零售价", "只数", "包装规格"];
    for (let key in goods_info) {
      const hasMatch = keywords.some((keyword) => key.includes(keyword));
      if (hasMatch) {
        goods_info[key] = convertPrice(goods_info[key]);
      }
    }
    console.log("获取的商品信息：", goods_info);
    return goods_info;
  }

  // 存入飞书表格
  async function saveToFeishu(goods_info) {
    try {
      // 分离字段
      const new_goods_info = {};
      let other_info_str = "";

      // 遍历所有字段
      for (const [key, value] of Object.entries(goods_info)) {
        if (GOODS_INFO_FIELDS.includes(key)) {
          new_goods_info[key] = value;
        } else {
          // 将值转换为字符串，如果是数组则用逗号连接
          const value_str = Array.isArray(value) ? value.join(',') : String(value);
          if (other_info_str) {
            other_info_str += `||${key}:${value_str}`;
          } else {
            other_info_str = `${key}:${value_str}`;
          }
        }
      }

      // 将其他信息添加到过滤后的信息中
      new_goods_info["其他信息"] = other_info_str;

      console.log("写入飞书表格：", new_goods_info);
      // 获取飞书表格
      const bitable = new FeishuBitable(
        "cli_a89441597738100e",
        "YOrEq802xGgC7fpzGlHkBdUZrisak1WK",
        "CHkabb1ufaAUORs4H5AcuqtKnIf",
        "tblDo5jIvt2wpEMi"
      );

      // 检查该商品是否存在
      const filter = {
        "conjunction": "and",
        "conditions": [
          {
            "field_name": "商品编码",
            "operator": "is",
            "value": [new_goods_info["商品编码"]]
          }
        ]
      };
      const records = await bitable.queryRecords(filter);
      if (records?.length > 0) {
        const record_ids = records.map(record => record["record_id"]);
        debugLog("商品已存在，先删除再写入", record_ids);
        // 删除商品
        await bitable.batchDeleteRecord(record_ids);
      }

      // 存入飞书表格
      const result = await bitable.addRecord(new_goods_info);
      debugLog("商品信息已成功保存到飞书表格：", result);
    } catch (error) {
      console.error("写入飞书表格失败:", error);
    }
  }

  // 主函数
  function main() {
    debugLog("脚本开始初始化");

    // 使用示例
    createGlobalStyle(`
            .disabled-button {
                background-color: #ccc;
                color: #666;
                cursor: not-allowed;
                pointer-events: none;
                opacity: 0.6;
            }
        `);

    const button = createDownloadButton();
    // 禁用按钮
    button.disabled = true;
    button.classList.add("disabled-button");

    // 延迟执行：主图向右按钮将主图加载完
    setTimeout(function () {
      let right_button = document.getElementsByClassName(
        "rcd-icon goodsdetail-image__bottom__right"
      )[0];
      right_button.click();
      // 启用按钮
      button.disabled = false;
      button.classList.remove("disabled-button");
    }, 1500);

    debugLog("脚本初始化完成");
  }

  // 等待页面加载完成后执行
  if (document.readyState === "loading") {
    debugLog("页面正在加载，等待DOMContentLoaded事件");
    document.addEventListener("DOMContentLoaded", main);
  } else {
    debugLog("页面已加载完成");
    main();
  }
})();
