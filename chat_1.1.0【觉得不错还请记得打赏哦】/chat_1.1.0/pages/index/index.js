//index.js

var app = getApp();
var that;
var chatListData = [];
var speakerInterval;
var plugin = requirePlugin("WechatSI");
let manager = plugin.getRecordRecognitionManager();

manager.onRecognize = function (res) {
  console.log("[Console log]:Current result:", res.result);
};
manager.onError = function (res) {
  console.error("[Console log]:Recognize error[" + res.retcode + ":" + res.msg + "]");
};
manager.onStop = function (res) {
  console.log("[Console log]:Record file path:", res.tempFilePath);
  console.log("[Console log]:Stop recording!Recognize result[" + res.result + "]");
  let seg = res.result;
  that.addChat(seg, 'r');
  console.log("[Console log]:Add user voice input to chat list");
  that.sendRequest(seg);
};
manager.onStart = function (res) {
  console.log("[Console log]:Start recording!", res);
};

Page({
  data: {
    defaultCorpus:'你都会什么',
    askWord: '',
    sendButtDisable:true,
    userInfo: {},
    chatList: [],
    scrolltop:'',
    keyboard:true,
    isSpeaking:false,
    speakerUrl:'/res/image/speaker0.png',
    speakerUrlPrefix:'/res/image/speaker',
    speakerUrlSuffix:'.png',
    filePath:null,
    contactFlag:true,
  },
  onLoad: function () {
    console.log("[Console log]:Loading...");
    that = this;
    this.sendRequest(this.data.defaultCorpus);
  },
  onReady: function () {

  },
  // 切换语音输入和文字输入
  switchInputType:function(){
    this.setData({
      keyboard: !(this.data.keyboard),
    })
  },
  // 监控输入框输入
  Typing:function(e){
    var inputVal = e.detail.value;
    var buttDis = true;
    if(inputVal.length != 0){
      var buttDis = false;
    }
    that.setData({
      sendButtDisable: buttDis,
    })
  },
  // 按钮按下
  touchdown:function(){
    this.setData({
      isSpeaking : true,
    })
    manager.start({
      duration: 30000, 
      lang: "zh_CN" 
    });
    that.speaking.call();
    console.log("[Console log]:Touch down!");
  },
  // 按钮松开
  touchup:function(){
    manager.stop();
    console.log("[Console log]:Touch up!");
    this.setData({
      isSpeaking: false,
      speakerUrl: '/res/image/speaker0.png',
    })
    clearInterval(that.speakerInterval);
  },
  // 发送语料到语义平台
  sendChat: function (e) {
    let word = e.detail.value.ask_word ? e.detail.value.ask_word : e.detail.value;
    console.log("[Console log]:User input:" + word);
    that.addChat(word, 'r');
    console.log("[Console log]:Add user input to chat list");
    that.setData({
      askWord: '',
      sendButtDisable: true,
    });
    that.sendRequest(word);
  },
  // 发送请求到语义平台
  sendRequest(corpus){
    app.NLIRequest(corpus, {
      'success': function (res) {
        if (res.status == "error") {
          wx.showToast({
            title: '返回数据有误！',
          })
          return;
        }
        var resjson = JSON.parse(res);
        var data = JSON.stringify(resjson.data);
        that.NLIProcess(data);
      },
      'fail': function (res) {
        wx.showToast({
          title: '请求失败！',
        })
        return;
      }
    }); 
  },
  // 处理语义
  NLIProcess: function(res){
    var nlires = JSON.parse(res);
    var nliArray = nlires.nli;
    if(nliArray == null || nliArray.length == 0){
      wx.showToast({
        title: '返回数据有误！',
      })
      return;
    }
    var answer = nliArray[0].desc_obj.result;
    if(answer == null){
      wx.showToast({
        title: '返回数据有误！',
      })
      return;
    }
    console.log("[Console log]:Add answer to chat list...");
    that.addChat(answer, 'l');
    var dataArray = nliArray[0].data_obj;
    if(dataArray != null && dataArray.length > 0){
      var objType = nliArray[0].type;
      if(objType == 'selection' && dataArray.length > 1){
        that.newsProcess(dataArray);
        return;
      }
      if (objType == 'news' && dataArray.length == 1) {
        console.log("[Console log]:Add news to chat list...");
        var title = dataArray[0].title;
        var detail = dataArray[0].detail;
        var news = title + "\n" + detail; 
        that.addChat(news, 'l');
        return;
      }
      var content = dataArray[0].content;
      if (content != null && content != answer){
        console.log("[Console log]:Add content to chat list...");
        that.addChat(content, 'l');
      }
    }
    return;
  },
  // 新闻类处理
  newsProcess(selectionArray){
    console.log("[Console log]:Selection display...");
    for(var i = 0; i < selectionArray.length; i++){
      var title = selectionArray[i].title;
      var detail = selectionArray[i].detail;
      if (detail.indexOf("\n") == 0){
        detail = detail.substring("\n".length);
      }
      var selectiondetail = "[第" + (i + 1) + "条]:" + title + "\r\n" + detail + "......";
      that.addChatWithFlag(selectiondetail, 'l',false);
    }
  },
  // 增加对话到显示界面（scrolltopFlag为True）
  addChat: function (word, orientation) {
    that.addChatWithFlag(word, orientation,true);
  },
  // 增加对话到显示界面（scrolltopFlag为是否滚动标志）
  addChatWithFlag: function (word, orientation, scrolltopFlag){
    let ch = { 'text': word, 'time': new Date().getTime(), 'orientation': orientation };
    chatListData.push(ch);
    var charlenght = chatListData.length;
    console.log("[Console log]:Add message to chat list...");
    if (scrolltopFlag){
      console.log("[Console log]:Rolling to the top...");
      that.setData({
        chatList: chatListData,
        scrolltop: "roll" + charlenght,
      });
    }else{
      console.log("[Console log]:Not rolling...");
      that.setData({
        chatList: chatListData,
      });
    }
  },
  // 分享功能
  onShareAppMessage: function (res) {
    console.log("[Console log]:Sharing the app...");
    return {
      desc: '智能聊',
      desc: '智能聊，比你还能聊~',
      path: 'pages/index/index',
      imageUrl: '/res/image/chat_logo.png',
      success: function (res) {
        console.log("[Console log]:Share app success...");
        console.log("[Console log]:" + res.errMsg);
      },
      fail: function (res) {
        console.log("[Console log]:Share app fail...");
        console.log("[Console log]:" + res.errMsg);
      }
    }
  },
  // 联系作者
  contactMe:function(){
    if(that.data.contactFlag){
      that.sendRequest("我的我的我的联系联系联系方式方式ha");
    }
    else{
      wx.showModal({
        title: '提示',
        content: '你都点过了，还点干嘛！！',
        showCancel:false,
      });
    }
    that.data.contactFlag = false;
  },
  // 麦克风帧动画 
  speaking:function() {
    //话筒帧动画 
    var i = 0;
    that.speakerInterval = setInterval(function () {
      i++;
      i = i % 7;
      that.setData({
        speakerUrl: that.data.speakerUrlPrefix + i + that.data.speakerUrlSuffix,
      });
      console.log("[Console log]:Speaker image changing...");
    }, 300);
  }
})
