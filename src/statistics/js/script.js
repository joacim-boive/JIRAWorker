'use strict';
var workLogs = [];
var logs = [];
var authors = {};

var init = function () {
    Flatpickr.l10ns.default.firstDayOfWeek = 1;

    $('input').on('change', function () {
        var data = {};
        data[this.id] = this.value;

        chrome.storage.local.set(data);
    });

    $('button').on('click', init);

    chrome.storage.local.get({
        'urlJIRA': '',
        'username': '',
        'password': '',
        'users': '',
        'dateFrom': '',
        'dateTo': ''
    }, function (storage) {
        $('#dateFrom').val(storage['dateFrom']);
        $('#dateTo').val(storage['dateTo']);

        getData(storage);

        flatpickr(".flatpickr", {
            wrap: true,
            weekNumbers: true, // show week numbers
            maxDate: new Date()
        });
    });
};

var toBase64 = function (input) {
    return window.btoa(unescape(encodeURIComponent(input)));
};

var getData = function (config) {
    var credentials = toBase64(config.username + ':' + config.password);
    var dates = {};
    var datesArray = [];

    var getBetweenDates = function (startDate, endDate) {
        var dates = [];
        var thisDate = {};

        startDate = config.dateFrom;
        endDate = config.dateTo;

        thisDate = new Date(startDate);
        endDate = new Date(endDate);

        while (thisDate <= endDate) {
            if (thisDate.getDay() > 0 && thisDate.getDay() < 6) {
                dates.push($.format.date(thisDate, 'yyyy-MM-dd'));
            }
            thisDate.setDate(thisDate.getDate() + 1)
        }

        return dates;
    };

    var getDates = function () {
        var dates = {};

        var from = config.dateFrom ? new Date(config.dateFrom) : new Date(date.setTime(date.getTime() - (7 * 86400000)));
        var to = config.dateTo ? new Date(config.dateTo) : new Date();

        dates.from = new Date(from.setHours(0, 0, 0, 0));
        dates.to = new Date(to.setHours(0, 0, 0, 0));

        return dates;
    };

    var getWorkLogDates = function () {
        var dates = getDates();

        var from = dates.from.getFullYear() + '-' + (dates.from.getMonth() + 1) + '-' + dates.from.getDate();
        var to = dates.to.getFullYear() + '-' + (dates.to.getMonth() + 1) + '-' + dates.to.getDate();

        return 'workLogDate >= ' + from + ' AND workLogDate <= ' + to;
    };

    var getJiras = $.ajax({
        url: config.urlJIRA + '/rest/api/2/search',
        type: 'GET',
        data: {
            'jql': getWorkLogDates() + ' and assignee in (' + config.users + ')',
            'fields': 'key',
            'maxResults': '1000'
        },
        headers: {
            'Authorization': 'Basic ' + credentials,
            'Content-Type': 'application/json'
        }
    });

    getJiras.then(function (jiras) {
        for (var i = 0, count = jiras.issues.length; i < count; i++) {
            workLogs.push($.ajax({
                    url: config.urlJIRA + '/rest/api/2/issue/' + jiras.issues[i].key + '/worklog',
                    type: 'GET',
                    tryCount: 0,
                    retryLimit: 3,
                    data: {
                        'maxResults': '1000'
                    },
                    headers: {
                        'Authorization': 'Basic ' + credentials,
                        'Content-Type': 'application/json'
                    }
                }).then(function (logWorks) {
                    logs.push(logWorks);
                }).fail(function () {
                    console.info('AJAX Failed - Retrying: ' + this.tryCount);

                    this.tryCount++;
                    if (this.tryCount <= this.retryLimit) {
                        $.ajax(this);
                        return;
                    }
                    return;
                })
            );
        }

        $.when.apply($, workLogs).done(function () {
            var dateLog = null;
            var dataDetails = {};
            var datasetDetails = {};
            var dataSummary = {};
            var datasetSummary = {};
            var key = 0;
            var color = {};
            var count = 0;
            var user = '';

            dataDetails.labels = getBetweenDates();
            dataDetails.datasets = [];
            dates = getDates();

            dataSummary.labels = [];
            dataSummary.datasets = [];

            datasetSummary.label = 'Summary for the period';
            datasetSummary.backgroundColor = [];
            datasetSummary.data = [];


            logs.forEach(function (log) {
                log.worklogs.forEach(function (workLog) {
                    dateLog = new Date(workLog.created).setHours(0, 0, 0, 0);

                    if (dateLog >= dates.from && dateLog <= dates.to) {

                        if (authors[workLog.author.emailAddress]) { //We got data for this user
                            authors[workLog.author.emailAddress].total += workLog.timeSpentSeconds;
                            if (authors[workLog.author.emailAddress][dateLog]) { //We got data for this date
                                authors[workLog.author.emailAddress][dateLog].hours += workLog.timeSpentSeconds;
                            } else {
                                authors[workLog.author.emailAddress][dateLog] = {};
                                authors[workLog.author.emailAddress][dateLog].hours = workLog.timeSpentSeconds;
                            }
                        } else {
                            authors[workLog.author.emailAddress] = {};
                            authors[workLog.author.emailAddress][dateLog] = {};
                            authors[workLog.author.emailAddress].total = workLog.timeSpentSeconds;
                            authors[workLog.author.emailAddress][dateLog].hours = workLog.timeSpentSeconds;
                        }
                    }
                })
            });


            for (var log in authors) {
                if (authors.hasOwnProperty(log)) {
                    color = new RColor;

                    user = log;
                    user = user.split('.');
                    user = user[0] + ' ' + user[1].substr(0, 1);

                    dataSummary.labels.push(user);

                    datasetDetails = {};
                    datasetDetails.data = [];
                    datasetDetails.label = user;
                    datasetDetails.borderColor = color.get(true);

                    datasetSummary.backgroundColor.push(color.get(true));

                    count++;

                    for (var i = 0, datesLen = dataDetails.labels.length; i < datesLen; i++) {
                        key = new Date(dataDetails.labels[i]).setHours(0, 0, 0, 0);

                        if (authors[log][key]) {
                            if (authors[log][key].hours) {
                                datasetDetails.data.push(authors[log][key].hours / 3600);
                            } else {
                                datasetDetails.data.push(0); //No time for this date
                            }
                        } else {
                            datasetDetails.data.push(0); //No time for this date
                        }
                    }
                    dataDetails.datasets.push(datasetDetails);

                    if (authors[log].total) {
                        datasetSummary.data.push(authors[log].total / 3600);
                    }
                }
            }

            dataSummary.datasets.push(datasetSummary);

            // authors[workLog.author.emailAddress].total

            Chart.defaults.global.elements.line.backgroundColor = 'transparent';
            Chart.defaults.global.elements.line.fill = false;

            var detailChart = new Chart(document.getElementById('detailChart'), {
                type: 'line',
                data: dataDetails,
                options: {
                    scales: {
                        yAxes: [{
                            ticks: {
                                beginAtZero: true
                            }
                        }]
                    }
                }
            });

            var summaryChart = new Chart(document.getElementById('summaryChart'), {
                type: 'bar',
                data: dataSummary,
                options: {
                    scales: {
                        yAxes: [{
                            ticks: {
                                beginAtZero: true
                            }
                        }]
                    }
                }
            });

        })
    });
};

init();