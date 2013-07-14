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
        concat: {
            options: {
                banner: '<%= banner %>',
                stripBanners: true
            },
            dist: {
                src: ['lib/<%= pkg.name %>.js'],
                dest: 'dist/<%= pkg.name %>.js'
            }
        },
        uglify: {
            options: {
                banner: '<%= banner %>'
            },
            dist: {
                src: '<%= concat.dist.dest %>',
                dest: 'dist/<%= pkg.name %>.min.js'
            }
        },
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
//    nodeunit: {
//      files: ['test/**/*_test.js']
//    },
        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint:gruntfile']
            },
            lib_test: {
                files: '<%= jshint.lib_test.src %>',
                tasks: ['jshint:lib_test' /*, 'nodeunit'*/]
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
                    }
                },
                files: [
                    {expand: true, flatten: true, src: ['src/cs-args-contract.js'], dest: 'dist/'}
                ]
            }
        }
    });

    // These plugins provide necessary tasks.
//    grunt.loadNpmTasks('grunt-contrib-concat');
//    grunt.loadNpmTasks('grunt-contrib-uglify');
//  grunt.loadNpmTasks('grunt-contrib-nodeunit');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-peg');
    grunt.loadNpmTasks('grunt-replace');

    // Default task.
    grunt.registerTask('default', ['jshint', /*'nodeunit',*/ 'peg', 'replace' /*, 'concat', 'uglify'*/]);

};
