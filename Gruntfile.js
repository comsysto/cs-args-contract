/*global module:false*/
module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        // Metadata.
        pkg: grunt.file.readJSON('package.json'),
        banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
            '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
            '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
            '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
            ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',
        // Task configuration.
        jshint: {
            options: {
                curly: true,
                eqeqeq: true,
                immed: true,
                latedef: true,
                newcap: true,
                noarg: true,
                sub: true,
                undef: true,
                unused: true,
                boss: true,
                eqnull: true,
                globals: {
                    // libraries
                    _: true,
                    // cs-args-contract stuff
                    cs_args_contract_factory: true,
                    checkArgs: true,
                    argsContract: true,
                    // jasmine stuff
                    describe: true,
                    it: true,
                    iit: true,
                    xit: true,
                    expect: true,
                    beforeEach: true,
                    afterEach: true
                },
                ignores: [
                    'lib/**'
                ]
            },
            gruntfile: {
                src: 'Gruntfile.js'
            },
            lib_test: {
                src: ['lib/**/*.js', 'test/**/*.js']
            }
        },
        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint:gruntfile']
            },
            lib_test: {
                files: '<%= jshint.lib_test.src %>',
                tasks: ['jshint:lib_test']
            }
        },
        peg: {
            options: { trackLineAndColumn: false },
            cs_args_contract_parser: {
                src: "src/cs-args-contract-parser.peg",
                dest: "generated/cs-args-contract-parser.js",
                options: {
                    exportVar: "this.cs_args_contract_parser",
                    cache: false,
                    output: 'source'
                }
            }
        },
        replace: {
            dist: {
                options: {
                    variables: {
                        'newLine' : '\n',
                        'parserSrc': '<%= grunt.file.read("generated/cs-args-contract-parser.js") %>'
                    },
                    force: true
                },
                files: [
                    {expand: true, flatten: true, src: ['src/cs-args-contract.js', 'src/cs-args-contract.min.js'], dest: 'dist/'}
                ]
            }
        },
        karma: {
            unit: {
                configFile: 'karma.conf.js',
                runnerPort: 9999,
                singleRun: true,
                browsers: ['PhantomJS']
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-peg');
    grunt.loadNpmTasks('grunt-replace');
    grunt.loadNpmTasks('grunt-karma');

    // Default task.
    grunt.registerTask('default', ['peg', 'jshint', 'karma', 'replace']);

};
