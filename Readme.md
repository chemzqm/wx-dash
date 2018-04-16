# 微信小程序 dash 文档

本文档集成了[官方文档](https://developers.weixin.qq.com/miniprogram/dev/) 中
框架、组件、API 三个部分，可以方便的搜索以及离线浏览，再也不用担心线上文档打不开了。

本项目包含了生成文档的脚本代码，目前使用服务器每日自动同步官方文档。请使用 Dash
feedurl 方式订阅。

## 使用方法

Dash -> Preferences -> Downloads -> 点击加号然后填入 url，对于 Dash > 3:

```
dash-feed://https%3A%2F%2Fraw.githubusercontent.com%2Fchemzqm%2Fwx-dash%2Fmaster%2Fwxdash.xml
```

Dash < 3:

```
https://raw.githubusercontent.com/chemzqm/wx-dash/master/wxdash.xml
```

## 本地运行

需要安装 nodejs > 9.0

``` sh
npm install
npm run build
```

## 运行过程

* 下载全部小程序 API 和组件线上文档到本地
* 读取 html 文件生成 docset
