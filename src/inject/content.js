'use strict';

(function(){
var $buttonTracker = {};
var $buttonTrackerState = '';
var $thisIcon = {};

chrome.extension.sendMessage({}, function () {
    var readyStateCheckInterval = setInterval(function () {

        if (document.readyState === 'complete') {
            clearInterval(readyStateCheckInterval);

            $('.toolbar-split.toolbar-split-left').append('<ul id="jirafier_container" class="toolbar-group pluggable-ops">' +
                '<li class="toolbar-item"><a id="jirafier-track" title="Click here to toggle tracking of this JIRA" class="toolbar-trigger" data-tracking-state="0">' +
                '<span class="icon icon-role-not-member"></span> <span class="trigger-label">Track: <span class="this-state">OFF</span></a></li></ul>');

            $buttonTracker = $('#jirafier-track');
            $buttonTrackerState = $buttonTracker.find('.this-state');
            $thisIcon = $buttonTracker.find('.icon');

            $buttonTracker.on('click', buttonTracker);

            init();
        }
    }, 10);
});

var buttonTracker = function (state) {
    var thisState = state;
    var data = {};
    var latestComment = '';

    if (typeof state === 'object') { //event
        thisState = $buttonTracker.attr('data-tracking-state');
    }

    thisState += '';

    if (thisState === '0') {
        latestComment = document.querySelector('.activity-comment');
        $buttonTracker.attr('data-tracking-state', '1');

        $thisIcon[0].className = 'icon icon-role-member';
        $buttonTrackerState.text('ON');

        data.title = $('#summary-val').text().trim();
        data.status = $('#status-val').text().trim();
        data.updated = $('#updated-date').find('.livestamp').attr('datetime');

        if(latestComment){
            data.latestCommentDate = latestComment.parentElement.lastElementChild.querySelector('time').getAttribute('datetime');
        }


        storage.add(data);
    } else {
        $buttonTracker.attr('data-tracking-state', '0');

        $thisIcon[0].className = 'icon icon-role-not-member';
        $buttonTrackerState.text('OFF');

        storage.remove();
    }
};

var storage = {};
storage.add = function (thisData) {
    var thisKey = key.get();
    var data = {};

    data[thisKey] = {};

    data[thisKey].id = thisKey;
    data[thisKey].url = window.location.protocol + '//' + window.location.hostname + window.location.pathname;
    data[thisKey].title = thisData.title;
    data[thisKey].status = thisData.status;
    data[thisKey].updated = thisData.updated;
    data[thisKey].latestCommentDate = thisData.latestCommentDate;

    chrome.storage.local.set(data);
};

storage.remove = function () {
    chrome.storage.local.remove(key.get());
};

storage.get = function () {
    chrome.storage.local.get(key.get(), function result() {
    });
};

storage.setStatus = function () {
    chrome.storage.local.get(key.get(), function (result) {
        if(result[document.title.split(']')[0].split('[')[1]]){
            buttonTracker(0); //We've stored this JIRA
        }else{
            buttonTracker(1);
        }

    });
};


var key = (function () {
    var get = function () {
        return document.title.split(']')[0].split('[')[1];
    };

    return {get: get}
}());

var init = function () {
    storage.setStatus();
};

}());