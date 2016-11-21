module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        ts: {
            default: {
                src: ['./src/index.ts'],
                outDir: 'dist'
            },
            options: {
                compiler: './node_modules/typescript/bin/tsc',
                declaration: true,
                target: 'es5'
            },
            tests: {
                src: ['./src/test/test.ts'],
                outDir: './dist/'
            }
        }
    });

    grunt.loadNpmTasks('grunt-ts');
    grunt.registerTask('default', ['ts']);
};