/// <reference path="../Q.js" />
/*
* Q.http.js http请求
* author:devin87@qq.com
* update:2017/07/24 17:10
*/
(function () {
    var URL = require('url'),
        querystring = require('querystring'),
        http = require('http'),
        https = require('https'),

        extend = Q.extend,
        fire = Q.fire,
        isFunc = Q.isFunc,
        isObject = Q.isObject;

    var ErrorCode = {
        HttpError: 1,
        JSONError: 2,
        Timedout: 3
    };

    var config = {
        timeout: 10000
    };

    /**
     * http设置
     * @param {object} settings {ErrorCode:{},config:{}}
     */
    function setup(settings) {
        if (settings.ErrorCode) extend(ErrorCode, settings.ErrorCode, true);
        if (settings.config) extend(config, settings.config, true);
    }

    /**
     * 触发http完成事件
     * @param {number} errCode 错误代码
     * @param {string|object} result 返回结果
     * @param {object} ops 请求配置项
     * @param {Response} res Response对象
     * @param {Error} err 错误对象
     */
    function fire_http_complete(errCode, result, ops, res, err) {
        fire(ops.complete, undefined, result, errCode, ops, res, err);
        fire(config.afterSend, undefined, result, errCode, ops, res, err);
    }

    /**
     * 
     * @param {string} url 请求地址
     * @param {object} ops 请求配置项
     */
    function http_send(url, ops) {
        ops = ops || {};

        //队列接口
        if (ops.queue) return ops.queue.add(url, ops);

        if (isFunc(ops)) ops = { success: ops };

        ops.url = url;

        var method = ops.type || ops.method || 'GET',
            headers = ops.headers || {},
            timeout = ops.timeout || config.timeout || {},

            is_http_post = method == 'POST',
            is_json = ops.dataType == 'JSON',
            data = ops.data,
            post_data = is_http_post && data ? querystring.stringify(data) : '';

        if (is_http_post) {
            extend(headers, {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(post_data, 'utf8')
            });
        } else {
            if (data) url = Q.join(url, data);
        }

        if (config.headers) extend(headers, config.headers);

        var uri = URL.parse(url);

        ops.options = {
            hostname: uri.hostname,
            path: uri.path,
            port: uri.port,
            method: method,
            headers: headers
        };

        var web = url.startsWith('https') ? https : http;

        fire(config.beforeSend, undefined, ops);

        var req = web.request(ops.options, function (res) {
            var buffers = [];
            res.on('data', function (chunk) {
                buffers.push(chunk);
            });

            res.on('end', function () {
                var text = buffers.join(''), data;
                if (!is_json) return fire_http_complete(undefined, text, ops, res);

                try {
                    data = JSON.parse(text);
                } catch (e) {
                    fire_http_complete(ErrorCode.JSONError, undefined, ops, res);
                }

                fire_http_complete(undefined, data, ops, res);
            });
        }).on('error', ops.error || config.error || function (err) {
            fire_http_complete(ErrorCode.HttpError, undefined, ops, undefined, err);
        });

        var timeout = ops.timeout || config.timeout;
        if (timeout && timeout != -1) {
            req.setTimeout(timeout, function () {
                fire_http_complete(ErrorCode.Timedout, undefined, ops);
            });
        }

        req.write(post_data);
        req.end();

        return req;
    }

    /**
     * http请求,简化调用
     * @param {string} url 请求地址
     * @param {object} data 要提交的参数对象
     * @param {function} cb 回调函数(data, errCode, ops, res, err)
     * @param {object} settings http设置
     */
    function http_send_simplpe(url, data, cb, settings) {
        var ops;

        if (isFunc(data)) {
            ops = { complete: data };
        } else if (isObject(cb)) {
            ops = cb;
            ops.data = data;
        } else {
            ops = { data: data, complete: cb };
        }

        //优先设置
        if (settings) extend(ops, settings, true);

        return http_send(url, ops);
    }

    /**
     * http GET 请求
     * @param {string} url 请求路径,支持http和https
     * @param {object} data 要提交的参数对象
     * @param {function} cb 回调函数(data,errCode)
     */
    function getHttp(url, data, cb) {
        return http_send_simplpe(url, data, cb);
    }

    /**
     * http POST 请求
     * @param {string} url 请求路径,支持http和https
     * @param {object} data 要提交的参数对象
     * @param {function} cb 回调函数(data,errCode)
     */
    function postHttp(url, data, cb) {
        return http_send_simplpe(url, data, cb, { type: 'POST' });
    }

    /**
     * http GET 请求,并将返回结果解析为JSON对象
     * @param {string} url 请求路径,支持http和https
     * @param {object} data 要提交的参数对象
     * @param {function} cb 回调函数(data,errCode)
     */
    function getJSON(url, data, cb) {
        return http_send_simplpe(url, data, cb, { dataType: 'JSON' });
    }

    /**
     * http POST 请求,并将返回结果解析为JSON对象
     * @param {string} url 请求路径,支持http和https
     * @param {object} data 要提交的参数对象
     * @param {function} cb 回调函数(data,errCode)
     */
    function postJSON(url, data, cb) {
        return http_send_simplpe(url, data, cb, { type: 'POST', dataType: 'JSON' });
    }

    extend(Q, {
        httpSetup: setup,
        getHttp: getHttp,
        postHttp: postHttp,
        getJSON: getJSON,
        postJSON: postJSON
    });
})();