module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        babel: {
            options: {
                sourceMap: true
            },
            dist: {
                files: {
                    'dist/index.js': 'src/index.js'
                }
            }
        }
    });

    grunt.registerTask('default', ['babel']);
};