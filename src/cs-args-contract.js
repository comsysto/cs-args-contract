(function() {
    /*
     * Copyright 2013 Otto Krammer
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     *
     */

    /**
     * Eval wrapper that has nothing internal in scope...
     * @param expression
     */
    function evalTypeExpression($$){

        // simple regex function
        function re(regex){
            if(_.isString(regex)){
                regex = new RegExp(regex);
            }
            return regex.test($$)
        }

        // simple length function
        function len(){
            return $$.length;
        }

        return eval(this.toString());
    }

    /**
     * Eval wrapper that has nothing internal in scope...
     * @param expression
     */
    function evalArgListExpression($1, $2, $3, $4, $5, $6, $7, $8, $9){
        return eval(this.toString());
    }

    /**
     * Main wrapper to contain all internal state so eval could not see it...
     */
    (function() {
        //window or global
        var root = this;

        // original reference to 'argsContract' just in case ;)
        var originalReference = root.argsContract;

        var lazyInstance = null;
        root.argsContract = function(args, contractString) {
            if (lazyInstance === null) {
                lazyInstance = factory();
            }
            return lazyInstance(args, contractString);
        };

        /**
         * factory method for testing
         */
        root.argsContract.factory = factory;

        /**
         * Method to restore the original value of 'argsContract' global variable
         */
        root.argsContract.noConflict = function() {
            if (_.isUndefined(originalReference)) {
                root.argsContract = undefined;
                try {
                    delete root.argsContract;
                } catch (e) {
                    // weird ie bug throws exception on deleting stuff from window
                }
            }
            root.argsContract = originalReference;
        };

        // parserHolder will be filled if the parser is injected in this source file via 'grunt'.
        var parserHolder = null;

        /**
         * This function is used to lookup the parser.
         * First the parserHolder is consulted, this field is used if the parser code is inlined via the build process.
         * If the parser holder is null, than the global scope is used, this is case if the raw source file is used, e.g. in
         * continuous testing via karma.
         * @returns {parse: function} the peg parser.
         */
        function parser() {
            return parserHolder ? parserHolder.cs_args_contract_parser : root.cs_args_contract_parser;
        }

        /**
         * In this object checking functions are keyed to there type name. The values are all functions that accept as
         * first parameter the type object and as second parameter the object that should be tested.
         * @type {{}}
         */
        var testFunctionForTypeName = {

            string: function(type, arg) {
                return _.isString(arg);
            },

            boolean: function(type, arg) {
                return _.isBoolean(arg);
            },

            'null': function(type, arg) {
                return _.isNull(arg);
            },

            'undefined': function(type, arg) {
                return _.isUndefined(arg);
            },

            any: function(type, arg) {
                return true;
            },

            number: function(type, arg) {
                return _.isNumber(arg);
            },

            date: function(type, arg){
                return _.isDate(arg);
            },

            regex: function(type, arg){
                return _.isRegExp(arg);
            },

            'function': function(type, arg) {
                return _.isFunction(arg);
            },

            or: function(type, arg) {
                return testObjectByType(type.left, arg) || testObjectByType(type.right, arg);
            },

            and: function(type, arg) {
                return testObjectByType(type.left, arg) && testObjectByType(type.right, arg);
            },

            not: function(type, arg) {
                return !testObjectByType(type.type, arg);
            },

            array: function(type, arg) {
                return _.isArray(arg) && _.every(arg, function(value) {
                    return testObjectByType(type.elementType, value);
                });
            },

            'object': function(type, arg) {
                if (!_.isObject(arg)) {
                    return false;
                }

                var types = type.properties;
                for (var key in types) {
                    if (types.hasOwnProperty(key)) {
                        var propType = types[key];
                        var propValue = arg[key];
                        if (!testObjectByType(propType, propValue)) {
                            return false;
                        }
                    }
                }
                return true;
            },

            hash: function(type, arg) {
                if (!_.isObject(arg)) {
                    return false;
                }

                for (var key in arg) {
                    if (arg.hasOwnProperty(key)) {
                        if (!testObjectByType(type.valueType, arg[key])) {
                            return false;
                        }
                    }
                }
                return true;
            },

            namedObject: function(type, arg) {
                return _.isObject(arg) && _.isFunction(arg.constructor) && functionName(arg.constructor) === type.ctorName;
            }

        };

        var errorMessagesForKey = {
            VARARGS_AND_OPTIONAL: 'Contract Error: The contract contains varargs and optional parameter.',
            VARARGS_OR_OPTIONAL_NOT_IN_ROW: 'Contract Error: All optional parameter must be in a row.',
            MULTIPLE_VARARGS: 'Contract Error: Only one varargs parameter is allowed.',
            SYNTAX_ERROR: 'Contract Error: There is a syntax error.',
            NO_PARSER_FOUND: 'Contract Error: No parser can be found.',
            ARG_COUNT: 'Contract Violation: Wrong number of arguments.',
            EXPRESSION: 'Contract Violation: Expression returned falsy value: ',
            EXPRESSION_ERROR: 'Contract Error: Failed evaluating expression: ',
            EXPRESSION_ARGS: 'Contract Violation: Failed evaluating expression: '
        };


        function functionName(func) {
            var match = func.toString().match(/function\s+([^\s\(]+)/);
            return match ? match[1] : '';
        }


        /**
         * Test if an object meet its type.
         * @param type The type defintion that is returned by the parser.
         * @param obj A Object to test.
         * @returns {boolean} if the object is compatible to the type definition
         */
        function testObjectByType(type, obj) {
            var testFunction = testFunctionForTypeName[type.name];
            var testResult = testFunction(type, obj);
            if(testResult && !_.isUndefined(type.expression)){
                try{
                    return evalTypeExpression.call(type.expression, obj);
                }catch(e){
                    var contractError = new ContractError('EXPRESSION_ERROR');
                    contractError.expression = type.expression;
                    throw contractError;

                }
            }

            return testResult;
        }

        /**
         * This function splits the params array.
         * The first part of the returned array is filled as long as the mandatory
         * property of the elements match the mandatory function parameter.
         *
         * @param {Array<{mandatory: boolean}>} params
         * @param {boolean} mandatory
         * @returns {Array<Array<{mandatory: boolean}>>} Returns an array with the two split array parts of the input. The
         * first part meeting the condition the second that don't meet the condition.
         */
        function splitByMandatory(params, mandatory) {
            var head = [];
            var tail = [];
            var testFailed = false;
            _(params).each(function(element) {
                if (element.mandatory !== mandatory) {
                    testFailed = true;
                }
                if (!testFailed) {
                    head.push(element);
                } else {
                    tail.push(element);
                }
            });

            return [head, tail];
        }

        /**
         * This function constructs a cachable object that represents a contract for an argument list.
         * @param {Array<{}>} paramContractList A array of  param objects that are returned from the parser.
         * @constructor
         */
        function Contract(paramContractList) {

            /**
             * Splits the paramContractList in 3 parts.
             * - The first part: a row of mandatory parameter contracts.
             * - The second part: a row of non mandatory parameter contracts.
             * - The third part: a row of mandatory parameter contracts.
             *
             * All parts can be empty, should a forth part of non mandatory parameter exists, a error is thrown.
             * @returns {Array} with exact 3 elements. Each an array of param contract objects.
             */
            function paramContractListIn3Parts() {
                var bothParts = splitByMandatory(paramContractList, true);
                // mandatory part
                var part1 = bothParts[0];
                bothParts = splitByMandatory(bothParts[1], false);
                // not mandatory part
                var part2 = bothParts[0];
                bothParts = splitByMandatory(bothParts[1], true);
                // mandatory part
                var part3 = bothParts[0];
                if (bothParts[1].length !== 0) {
                    throw new ContractError("VARARGS_OR_OPTIONAL_NOT_IN_ROW");
                }

                var notMadatoryParamContractsByType = _(part2).groupBy('name');
                if (_(notMadatoryParamContractsByType).keys().length > 1) {
                    throw new ContractError("VARARGS_AND_OPTIONAL");
                }
                var varargsParamContracts = notMadatoryParamContractsByType['varargsParam'];
                if (!_.isUndefined(varargsParamContracts) && varargsParamContracts.length > 1) {
                    throw new ContractError("MULTIPLE_VARARGS");
                }
                return [part1, part2, part3];
            }

            /**
             * Throws a ContractViolation with the key for invalid arg count.
             */
            function errorIllegalArgCount() {
                throw new ContractViolation("ARG_COUNT");
            }

            /**
             * Checks the varargs part form an argument list by the provided list of param contracts.
             * @param args Parts of the arguments object
             * @param paramContracts A list of varargsParam objects returned from the parser of length 1.
             * @param indexOffset The start index of the arguments part in the whole arguments object.
             */
            function checkVarargs(args, paramContracts, indexOffset) {
                var typeOfVarargs = paramContracts[0].type;
                _(args).each(function(arg, index) {
                    var result = testObjectByType(typeOfVarargs, arg);
                    if (!result) {
                        throw new ContractViolation(indexOffset + index + 1);
                    }
                });

            }

            /**
             * Checks the optional part form an argument list by the provided list of param contracts.
             * @param args Parts of the arguments object
             * @param paramContracts A list of optionalParam objects returned from the parser
             * @param indexOffset The start index of the arguments part in the whole arguments object.
             */
            function checkOptional(args, paramContracts, indexOffset) {
                _(args).each(function(arg, index) {
                    var contract = paramContracts[index];
                    var result = testObjectByType(contract.type, arg);
                    if (!result) {
                        throw new ContractViolation(indexOffset + index + 1);
                    }
                });
                return null;
            }

            /**
             * Checks the mandatory part form an argument list by the provided list of param contracts.
             * @param args Parts of the arguments object
             * @param paramContracts A list of param objects returned from the parser
             * @param indexOffset The start index of the arguments part in the whole arguments object.
             */
            function checkMandatory(args, paramContracts, indexOffset) {
                _(paramContracts).each(function(contract, index) {
                    var arg = args[index];
                    var result = testObjectByType(contract.type, arg);
                    if (!result) {
                        throw new ContractViolation(indexOffset + index + 1);
                    }
                });
            }

            var parts = paramContractListIn3Parts();
            var contractPart1 = parts[0];
            var contractPart2 = parts[1];
            var contractPart3 = parts[2];

            /**
             * Checks the argument list against this contract.
             * @param argList
             */
            this.checkArgs = function(argList) {
                if (argList.length < contractPart1.length + contractPart3.length) {
                    errorIllegalArgCount();
                }
                var argsPart1 = argList.slice(0, contractPart1.length);
                checkMandatory(argsPart1, contractPart1, 0);

                var beginIndexPart3 = argList.length - contractPart3.length;
                var argsPart3 = argList.slice(beginIndexPart3, argList.length);
                checkMandatory(argsPart3, contractPart3, beginIndexPart3);

                var beginIndexPart2 = contractPart1.length;
                var argsPart2 = argList.slice(beginIndexPart2, beginIndexPart3);
                if (contractPart2.length > 0 && contractPart2[0].varargs) {
                    checkVarargs(argsPart2, contractPart2, beginIndexPart2);
                } else {
                    if (argsPart2.length > contractPart2.length) {
                        errorIllegalArgCount();
                    }
                    checkOptional(argsPart2, contractPart2, beginIndexPart2);
                }
            }
        }

        /**
         * A instance of the ctor is thrown if the contract is invalid.
         *
         * @param {string} code possible codes are ARG_COUNT, SYNTAX_ERROR, VARARGS_OR_OPTIONAL_NOT_IN_ROW,
         * VARARGS_AND_OPTIONAL, MULTIPLE_VARARGS, NO_PARSER_FOUND
         * @constructor
         */
        function ContractError(code) {
            this.name = "ContractError";
            this.code = code;
        }

        /**
         * A instance of the ctor is thrown if the arguments don't match the contract.
         *
         * @param {string|number} code possible codes are ARG_COUNT or the index of the argument that failed the test.
         * @constructor
         */
        function ContractViolation(code) {
            this.name = "ContractViolation";
            this.code = code;
        }

        /**
         * This function parses the input string and returns a list of param objects.
         * @param contractString The string representation of a contract.
         * @returns {Array<{}>} A list of param objects from the parser.
         */
        function parse(contractString) {
            if (_.isUndefined(parser()) || _.isNull(parser())) {
                throw new ContractError("NO_PARSER_FOUND");
            }
            try {
                var baseContract = parser().parse(contractString);
            } catch (e) {
                throw new ContractError("SYNTAX_ERROR");
            }
            return baseContract;
        }

        /**
         * Creates a human readable error message.
         * @param {{code: string}} error The thrown error.
         * @param {string} contract The contract string
         * @param {Array} args The arguments that should be tested
         * @returns {Error} A human readable error message.
         */
        function createError(error, contract, args) {
            var baseMessage = error.code;
            if (_.isNumber(error.code)) {
                baseMessage = 'Contract Violation: Argument ' + error.code + ' is invalid.';
            } else {
                baseMessage = errorMessagesForKey[error.code];
            }

            if(!_.isUndefined(error.expression)){
                baseMessage = baseMessage + "Expression failed: {" + error.expression + "}";
            }

            var argsDebug = _(args).toArray();
            try{
                argsDebug = JSON.stringify(argsDebug);
            }catch(e){
                // ignore format errors, this can happen if there is circle in the args object graph
            }

            var newError = new Error(baseMessage + ' Contract: \'' + contract + '\' Arguments: ' + argsDebug);
            newError.name = error.name;
            newError.code = error.code;
            newError.contract = contract;
            newError.arguments = args;
            return  newError;
        }

        /**
         * This function creates a new 'instance' of the library.
         * This instance encloses all changeable state.
         */
        function factory() {

            /**
             * caches the contract instances by its string representation.
             * @type {{}}
             */
            var contractCache = {};

            /**
             * Returns a cached Contract or create a new one for the contractString.
             *
             * @param contractString the string represetation of the contract.
             * @return { Contract } the cached contract instance if it exists or a new one.
             */
            function getContract(contractString) {
                var contract = contractCache[contractString];
                if (!_(contract).isUndefined()) {
                    return contract;
                }

                var baseContract = parse(contractString);
                contract = new Contract(baseContract, contractString);
                contractCache[contractString] = contract;
                return contract;
            }


            /**
             * Checks the argument list against the contract.
             * @param argList
             * @param contractString
             */
            function checkArgs(argList, contractString) {
                try {
                    var contract = getContract(contractString);
                    contract.checkArgs(_.toArray(argList));
                    var expressions = _(arguments).toArray().slice(2, arguments.length);
                    _(expressions).each(function(expression){
                        if(!evalArgListExpression.apply(expression, argList)){
                            throw {name: 'ContractViolation', code: 'EXPRESSION_ARGS', expression: expression};
                        }
                    });

                } catch (e) {
                    if (e.name === 'ContractError' || e.name === 'ContractViolation') {
                        // find a better way to create a stacktrace
                        e = createError(e, contractString, argList);
                    }
                    throw e;
                }
            }

            // make cache accessable for the test cases.
            checkArgs._cache = contractCache;
            return checkArgs

        }

        /**
         * This wrapper contains the generated parser, injected by the build process.
         * The parser is bound to the 'this.cs_args_contract_parser' of the wrapper and is accessed via the parser()
         * function.
         */
        (function parserSrc() {
            // BEGIN GENERATED PARSER @@newLine @@newLine @@parserSrc @@newLine @@newLine // END GENERATED PARSER
        }).call(parserHolder);

    }).call(this);

}).call(this);
