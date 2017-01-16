'use strict';
(function(){
    var init = function(){
        $('#JIRAWorkerSetup').find('input').change(function(){
            var data = {};
            var thisValue = this.value.trim();

            thisValue = thisValue.split(', ').join(',');
            thisValue = thisValue.split(' ,').join(',');

            data[this.id] = thisValue;
            chrome.storage.local.set(data);
        });

        $('#openStats').on('click', function(){
            chrome.tabs.create({url: 'src/statistics/index.html'});
        });

        chrome.storage.local.get(function(storage){
            var thisField = {};

            for (var field in storage){
                if(storage.hasOwnProperty(field)){
                    thisField = document.getElementById(field);
                    if(thisField){
                        thisField.value = storage[field];
                    }
                }
            }
        })
    };

    init();

})();