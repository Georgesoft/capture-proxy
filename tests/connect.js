var util = require('util');
var capture = require('../index');
var sinon = require('sinon');
var expect = require('expect.js');
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');

describe('connect', function () {
    var proxy = {
        listen: function () {}
    };
    var port = '8000';

    function listen (app, port, options) {
        options = options || {};
        options.silent = true;

        return capture.listen(app, port, options);
    }

    beforeEach(function () {
        sinon.stub(proxy, 'listen');
        sinon.stub(http, 'createServer').returns(proxy);
    });

    afterEach(function () {
        http.createServer.restore();
        proxy.listen.restore();
    });

    it('should open a http connection', function () {
        listen('http://my.host.com/', port, { output: '.' });

        expect(http.createServer.callCount).to.be(1);
        expect(proxy.listen.callCount).to.be(1);
        expect(proxy.listen.args[0]).to.eql([port, 'localhost']);
    });

    it('should open a https connection', function () {
        listen('https://my.host.com/', port);

        expect(http.createServer.callCount).to.be(1);
        expect(proxy.listen.callCount).to.be(1);
        expect(proxy.listen.args[0]).to.eql([port, 'localhost']);
    });

    it('should not open a non http/https connection', function () {
        expect(function () {
            listen('ftp://my.host.com/', port, { output: '.' });
        }).to.throwException();
    });

    it('should open a https connection, when requests and responses are enabled', function () {
        listen('https://my.host.com/', port, { response: true, request: true, output: '.' });

        expect(http.createServer.callCount).to.be(1);
        expect(proxy.listen.callCount).to.be(1);
        expect(proxy.listen.args[0]).to.eql([port, 'localhost']);
    });

    it('should fail when no output path specified, but responses are enabled', function () {
        expect(function () {
            listen('http://my.host.com/', port, { response: true });
        }).to.throwException();
    });

    it('should fail when no output path specified, but requests and responses are enabled', function () {
        expect(function () {
            listen('http://my.host.com/', port, { response: true, request: true });
        }).to.throwException();
    });

    describe('paths', function () {
        var targetFolder, existsStub;

        beforeEach(function () {
            existsStub = sinon.stub(fs, 'existsSync');
            sinon.stub(fs, 'mkdirSync');
        });

        afterEach(function () {
            fs.existsSync.restore();
            fs.mkdirSync.restore();
        });

        describe('existing paths', function () {
            beforeEach(function () {
                existsStub.returns(true);
            });

            it('should map existing relative paths `.`', function () {
                targetFolder = ['.'];

                listen('http://my.host.com/', port, { response: true, output: targetFolder.join(path.sep) });
                expect(fs.mkdirSync.callCount).to.be(0);
            });

            it('should map existing relative paths `./output`', function () {
                targetFolder = ['.', 'output'];

                listen('http://my.host.com/', port, { response: true, output: targetFolder.join(path.sep) });

                expect(fs.mkdirSync.callCount).to.be(0);
            });

            it('should map existing absolute paths `/c/folder/output`', function () {
                targetFolder = ['', 'c', 'folder', 'output'];

                listen('http://my.host.com/', port, { response: true, output: targetFolder.join(path.sep) });

                expect(fs.mkdirSync.callCount).to.be(0);
            });
        });

        describe('new paths', function () {
            beforeEach(function () {
                existsStub.returns(false);
            });

            it('should map existing relative paths `.`', function () {
                targetFolder = ['.'];
                existsStub.withArgs('.').returns(true);

                listen('http://my.host.com/', port, { response: true, output: targetFolder.join(path.sep) });
                expect(fs.mkdirSync.callCount).to.be(0);
            });

            it('should map existing relative paths `./output`', function () {
                targetFolder = ['.', 'output'];
                existsStub.withArgs('.').returns(true);

                listen('http://my.host.com/', port, { response: true, output: targetFolder.join(path.sep) });

                expect(fs.mkdirSync.callCount).to.be(1);
                expect(fs.mkdirSync.args[0][0]).to.be(targetFolder.join(path.sep));
            });

            it('should map existing absolute paths `/c/folder/output`', function () {
                targetFolder = ['', 'c', 'folder', 'output'];
                existsStub.withArgs(targetFolder.slice(0, 2).join(path.sep)).returns(true);

                listen('http://my.host.com/', port, { response: true, output: targetFolder.join(path.sep) });

                expect(fs.mkdirSync.callCount).to.be(2);
                expect(fs.mkdirSync.args[0][0]).to.be(targetFolder.slice(0, 3).join(path.sep));
                expect(fs.mkdirSync.args[1][0]).to.be(targetFolder.slice(0, 4).join(path.sep));
            });

            it('should map existing absolute paths `c:\\folder\\temp\\output`', function () {
                targetFolder = ['c:', 'folder', 'temp', 'output'];
                existsStub.withArgs(targetFolder.slice(0, 1).join(path.sep)).returns(true);

                listen('http://my.host.com/', port, { response: true, output: targetFolder.join(path.sep) });

                expect(fs.mkdirSync.callCount).to.be(3);
                expect(fs.mkdirSync.args[0][0]).to.be(targetFolder.slice(0, 2).join(path.sep));
                expect(fs.mkdirSync.args[1][0]).to.be(targetFolder.slice(0, 3).join(path.sep));
                expect(fs.mkdirSync.args[2][0]).to.be(targetFolder.slice(0, 4).join(path.sep));
            });
        });
    });

    describe('requests', function () {
        function triggerRequest () {
            expect(http.createServer.args[0][0]).to.be.a(Function);
            http.createServer.args[0][0]({ url: '/', headers: {} });
        }

        beforeEach(function () {
            sinon.stub(https, 'request').returns({
                on: sinon.stub(),
                end: sinon.stub()
            });

            sinon.stub(http, 'request').returns({
                on: sinon.stub(),
                end: sinon.stub()
            });
        });

        afterEach(function () {
            https.request.restore();
            http.request.restore();
        });

        describe('http/https', function () {
            it('should use the http client when listening to a host with the `http` protocol', function () {
                listen('http://my.host.com/', port, {});
                triggerRequest();

                expect(https.request.callCount).to.be(0);
                expect(http.request.callCount).to.be(1);
            });

            it('should use the https client when listening to a host with the `https` protocol', function () {
                listen('https://my.host.com/', port, {});
                triggerRequest();

                expect(https.request.callCount).to.be(1);
                expect(http.request.callCount).to.be(0);
            });
        });

        describe('rejectUnauthorized', function () {
            it('should send the `rejectUnauthorized: true` property by default', function () {
                listen('http://my.host.com/', port, {});
                triggerRequest();

                expect(http.request.callCount).to.be(1);
                expect(http.request.args[0][0]).to.have.property('rejectUnauthorized', true);
            });

            it('should send the `rejectUnauthorized: true` property when `insecure: false`', function () {
                listen('http://my.host.com/', port, { insecure: false });
                triggerRequest();

                expect(http.request.callCount).to.be(1);
                expect(http.request.args[0][0]).to.have.property('rejectUnauthorized', true);
            });

            it('should send the `rejectUnauthorized: false` property when `insecure: true`', function () {
                listen('http://my.host.com/', port, { insecure: true });
                triggerRequest();

                expect(http.request.callCount).to.be(1);
                expect(http.request.args[0][0]).to.have.property('rejectUnauthorized', false);
            });
        });
    });
});
