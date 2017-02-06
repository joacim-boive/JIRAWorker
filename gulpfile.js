var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var htmlReplace = require('gulp-html-replace');
var replaceTask = require('gulp-replace-task');
var concatCSS = require('gulp-concat-css');
var minifyCSS = require('gulp-clean-css');


var pathToBower = 'bower_components/';
var pathToSource = 'src/';
var destinationPath = 'dist/';

gulp.task('copyJSLibs', function() {
    return gulp.src([
        pathToBower + 'jquery/dist/jquery.min.js',
        pathToBower + 'bootstrap/dist/js/bootstrap.min.js',
        pathToBower + 'jquery-dateFormat/dist/jquery-dateFormat.min.js',
        pathToBower + 'flatpickr/dist/flatpickr.min.js',
        pathToBower + 'chart.js/dist/Chart.min.js',
        pathToBower + 'RandomColor/rcolor.js'
    ])
        .pipe(gulp.dest(destinationPath + 'js/libs/'));
});
gulp.task('copyCSSLibs', function() {
    return gulp.src([
        pathToBower + 'bootstrap/dist/css/bootstrap.min.css',
        pathToBower + 'flatpickr/dist/flatpickr.min.css'
    ])
        .pipe(gulp.dest(destinationPath + 'css/libs/'));
});

gulp.task('replace-manifest', function() {
    return gulp.src(['manifest.json'])
        .pipe(replaceTask({
            patterns:[
                {match: /src\//g,
                replacement:''}
            ]
        }))
        .pipe(gulp.dest(destinationPath));
});

gulp.task('copy-browser-action-html', function() {
    return gulp.src(['src/browser_action/*'])
        .pipe(replaceTask({
            patterns:[
                {match: /\/bower_components\/jquery\/dist/g,
                    replacement:'../js/libs'}
            ]
        }))
        .pipe(gulp.dest(destinationPath + '/browser_action'));
});
gulp.task('copy-browser-action-js', function() {
    return gulp.src(['src/browser_action/js/*'])
        .pipe(gulp.dest(destinationPath + '/browser_action/js'));
});

gulp.task('browser-action-files', function(){
    gulp.start('copy-browser-action-html');
    gulp.start('copy-browser-action-js');
    // gulp.start('copy-browser-action-css');
});

gulp.task('copy-files', function() {
    gulp.start('copyJSLibs');
    gulp.start('copyCSSLibs');
});

gulp.task('main', function() {
    gulp.start('copy-files');
});