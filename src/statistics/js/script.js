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

    function getStorage(isNoInit) {
        workLogs = [];
        logs = [];
        authors = {};

        chrome.storage.local.get({
            'urlJIRA': '',
            'username': '',
            'password': '',
            'usersOne': '',
            'usersOneLabel': '',
            'usersTwo': '',
            'usersTwoLabel': '',
            'dateFrom': '',
            'dateTo': ''
        }, function (storage) {

            getData(storage);

            if (!isNoInit) {
                $('#dateFrom').val(storage['dateFrom']);
                $('#dateTo').val(storage['dateTo']);

                flatpickr(".flatpickr", {
                    wrap: true,
                    weekNumbers: true, // show week numbers
                    maxDate: new Date()
                });
            }

        });
    }

    getStorage();

    $('button').on('click', function () {
        getStorage(true)
    });
};

var toBase64 = function (input) {
    return window.btoa(unescape(encodeURIComponent(input)));
};

var velocity = (function () {
    var data = {};

    var init = function () {
        data['VELOCITY'] = {};
        data = data['VELOCITY'];
        data.key = 'VELOCITY';
        data.total = 0;
    };

    var add = function (obj, key) {
        if (data[key]) {
            data[key].total += obj ? (obj.hours / 3600) : 0;
            data[key].count++
        } else {
            data[key] = {};
            data[key].total = obj ? obj.hours / 3600 : 0;
            data[key].count = 1;
        }
    };

    var average = function () {
        var dataset = {};
        var thisData = [];
        var total = 0;
        var average = 0;

        for (var date in data) {
            if (data.hasOwnProperty(date)) {
                if (date.length === 13) { //This is a dateTime in milliseconds
                    average = data[date].total / data[date].count;
                    thisData.push(average);
                    total += average;
                }
            }
        }

        dataset.data = thisData;
        dataset.label = 'VELOCITY';
        dataset.borderColor = 'rgba(0,0,0,0.1)';
        dataset.backgroundColor = 'rgba(182, 219, 251, 0.2)';
        dataset.fill = true;
        dataset.borderWidth = 2;
        dataset.pointStyle = 'rect';

        dataset.total = total;

        return dataset;
    };


    return {
        init: init,
        add: add,
        average: average
    }
}());

var getData = function (config) {
    var credentials = toBase64(config.username + ':' + config.password);
    var dates = {};
    var dataTeamOne = {};
    var dataTeamTwo = {};

    config.users = '';
    config.users = config.usersOne;


    if (config.usersTwo) {
        if (config.users) {
            config.users += ',' + config.usersTwo;
        } else {
            config.users = config.usersTwo;
        }
    }

    config.users = config.users.split(',');
    config.usersOne = config.usersOne.split(',');
    config.usersTwo = config.usersTwo.split(',');

    config.users = config.users.filter(function (item, pos) {
        return config.users.indexOf(item) == pos;
    });

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
        var date = new Date();

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
    }).then(function (jiras) {
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
            var key = 0;
            var color = {};
            var count = 0;
            var user = '';
            var html = '';

            dates = getDates();

            logs.forEach(function (log) {
                log.worklogs.forEach(function (workLog) {
                    if (config.users.indexOf(workLog.author.key) == -1) {
                        return;
                    }

                    dateLog = new Date(workLog.started).setHours(0, 0, 0, 0);

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
                            authors[workLog.author.emailAddress].key = workLog.author.key;
                            authors[workLog.author.emailAddress][dateLog] = {};
                            authors[workLog.author.emailAddress].total = workLog.timeSpentSeconds;
                            authors[workLog.author.emailAddress][dateLog].hours = workLog.timeSpentSeconds;
                        }
                    }
                })
            });


            function createDataset(keys, data, label, id) {
                var detailsData = {};
                var detailsDataset = {};
                var summaryData = {};
                var summaryDataset = {};
                var thisVelocity = {};

                detailsData.labels = getBetweenDates();
                detailsData.datasets = [];

                summaryData.labels = [];
                summaryData.datasets = [];

                summaryDataset.label = label;
                summaryDataset.backgroundColor = [];
                summaryDataset.data = [];


                velocity.init();

                for (var log in authors) {
                    if (authors.hasOwnProperty(log)) {
                        if (keys.indexOf(authors[log].key) != -1) { //Not a member of current set
                            color = new RColor;
                            color = color.get(true);

                            user = log;
                            user = user.split('.');
                            user = user[0] + ' ' + user[1].substr(0, 1);

                            summaryData.labels.push(user);

                            detailsDataset = {};
                            detailsDataset.data = [];
                            detailsDataset.label = user;
                            detailsDataset.borderColor = color;

                            summaryDataset.backgroundColor.push(color);

                            count++;

                            for (var i = 0, datesLen = detailsData.labels.length; i < datesLen; i++) {
                                key = new Date(detailsData.labels[i]).setHours(0, 0, 0, 0);
                                velocity.add(authors[log][key], key);

                                if (authors[log][key]) {
                                    if (authors[log][key].hours) {
                                        detailsDataset.data.push(authors[log][key].hours / 3600);
                                    } else {
                                        detailsDataset.data.push(0); //No time for this date
                                    }
                                } else {
                                    detailsDataset.data.push(0); //No time for this date
                                }
                            }
                            detailsData.datasets.push(detailsDataset);

                            if (authors[log].total) {
                                summaryDataset.data.push(authors[log].total / 3600);
                            }
                        }
                    }
                }

                thisVelocity = velocity.average();

                // $('#' + id).html(Math.round(((thisVelocity.total / thisVelocity.data.length) / 8) * 100));

                detailsData.datasets.push(thisVelocity);

                summaryData.datasets.push(summaryDataset);
                summaryData.datasets.push(thisVelocity);

                data.summary = summaryData;
                data.details = detailsData;

                return data;
            }

            dataTeamOne = createDataset(config.usersOne, dataTeamOne, config.usersOneLabel, 'velocityOne');
            dataTeamTwo = createDataset(config.usersTwo, dataTeamTwo, config.usersTwoLabel, 'velocityTwo');

            Chart.defaults.global.elements.line.fill = false;
            Chart.defaults.global.legend.labels.boxWidth = 4;
            Chart.defaults.global.elements.tension = 0.2;

            var customTooltips = function(tooltip) {
                // Tooltip Element
                var tooltipEl = document.getElementById('chartjs-tooltip');


                if (!tooltipEl) {
                    tooltipEl = document.createElement('div');
                    tooltipEl.id = 'chartjs-tooltip';
                    tooltipEl.innerHTML = "<table></table>";
                    document.body.appendChild(tooltipEl);
                }

                // Hide if no tooltip
                if (tooltip.opacity === 0) {
                    tooltipEl.style.opacity = 0;
                    return;
                }

                // Set caret Position
                tooltipEl.classList.remove('above', 'below', 'no-transform');
                if (tooltip.yAlign) {
                    tooltipEl.classList.add(tooltip.yAlign);
                } else {
                    tooltipEl.classList.add('no-transform');
                }

                function getBody(bodyItem) {
                    return bodyItem.lines;
                }

                // Set Text
                if (tooltip.body) {
                    var titleLines = tooltip.title || [];
                    var bodyLines = tooltip.body.map(getBody);

                    var innerHtml = '<thead>';

                    titleLines.forEach(function(title) {
                        innerHtml += '<tr><th>' + title + '</th></tr>';
                    });
                    innerHtml += '</thead><tbody>';

                    bodyLines.forEach(function(body, i) {
                        var colors = tooltip.labelColors[i];
                        var style = 'background:' + colors.backgroundColor;
                        style += '; border-color:' + colors.borderColor;
                        style += '; border-width: 2px';
                        var span = '<span class="chartjs-tooltip-key" style="' + style + '"></span>';
                        innerHtml += '<tr><td>' + span + body + '</td></tr>';
                    });
                    innerHtml += '</tbody>';

                    var tableRoot = tooltipEl.querySelector('table');
                    tableRoot.innerHTML = innerHtml;
                }

                var position = this._chart.canvas.getBoundingClientRect();

                // Display, position, and set styles for font
                tooltipEl.style.opacity = 1;
                tooltipEl.style.left = position.left + tooltip.caretX + 'px';
                tooltipEl.style.top = position.top + tooltip.caretY + 'px';
                // tooltipEl.style.fontFamily = tooltip._fontFamily;
                // tooltipEl.style.fontSize = tooltip.fontSize;
                // tooltipEl.style.fontStyle = tooltip._fontStyle;
                tooltipEl.style.padding = tooltip.yPadding + 'px ' + tooltip.xPadding + 'px';
            };

            function createChart(id, data, type) {
                var thisVelocity = {};
                var velocity = 0;

                if(type === 'bar'){
                    thisVelocity = data.datasets[1];
                    velocity = Math.round(((thisVelocity.total / thisVelocity.data.length) / 8) * 100);

                    data.datasets[0].label += ' - Current Velocity: ' + velocity + '%';

                    data.datasets.splice(-1,1);
                }

                return new Chart(document.getElementById(id), {
                    type: type,
                    data: data,
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
            }

            html = '<div class="row">';
            html += '<div class="col-md-6"><canvas id="r1c1"></canvas></div>';
            html += '<div class="col-md-6"><canvas id="r1c2"></canvas></div>';
            html += '</div>';

            if (dataTeamOne.details.datasets.length > 0 && dataTeamTwo.details.datasets.length > 0) {
                html += '<div class="row">';
                html += '<div class="col-md-6"><canvas id="r2c1"></canvas></div>';
                html += '<div class="col-md-6"><canvas id="r2c2"></canvas></div>';
                html += '</div>';
            }

            document.getElementById('charts').innerHTML = html;

            if (dataTeamOne.details.datasets.length > 0 && dataTeamTwo.details.datasets.length > 0) {
                createChart('r1c1', dataTeamOne.details, 'line');
                createChart('r1c2', dataTeamTwo.details, 'line');

                createChart('r2c1', dataTeamOne.summary, 'bar');
                createChart('r2c2', dataTeamTwo.summary, 'bar');
            } else {
                if (dataTeamOne.details.datasets.length > 0) {
                    createChart('r1c1', dataTeamOne.details, 'line');
                    createChart('r1c2', dataTeamOne.summary, 'bar');
                }
                if (dataTeamTwo.details.datasets.length > 0) {
                    createChart('r1c1', dataTeamTwo.details, 'line');
                    createChart('r1c2', dataTeamTwo.summary, 'bar');
                }
            }
        })
    });
};

init();