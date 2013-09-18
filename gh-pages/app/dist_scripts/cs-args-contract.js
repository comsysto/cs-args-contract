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

            var newError = new Error(baseMessage + ' Contract: ' + contract + ' Arguments: ' + JSON.stringify(_(args).toArray()));
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
            // BEGIN GENERATED PARSER 
 
 this.cs_args_contract_parser = (function(){
  /*
   * Generated by PEG.js 0.7.0.
   *
   * http://pegjs.majda.cz/
   */
  
  function quote(s) {
    /*
     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
     * string literal except for the closing quote character, backslash,
     * carriage return, line separator, paragraph separator, and line feed.
     * Any character may appear in the form of an escape sequence.
     *
     * For portability, we also escape escape all control and non-ASCII
     * characters. Note that "\0" and "\v" escape sequences are not used
     * because JSHint does not like the first and IE the second.
     */
     return '"' + s
      .replace(/\\/g, '\\\\')  // backslash
      .replace(/"/g, '\\"')    // closing quote character
      .replace(/\x08/g, '\\b') // backspace
      .replace(/\t/g, '\\t')   // horizontal tab
      .replace(/\n/g, '\\n')   // line feed
      .replace(/\f/g, '\\f')   // form feed
      .replace(/\r/g, '\\r')   // carriage return
      .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape)
      + '"';
  }
  
  var result = {
    /*
     * Parses the input with a generated parser. If the parsing is successfull,
     * returns a value explicitly or implicitly specified by the grammar from
     * which the parser was generated (see |PEG.buildParser|). If the parsing is
     * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
     */
    parse: function(input, startRule) {
      var parseFunctions = {
        "paramList": parse_paramList,
        "param": parse_param,
        "expression": parse_expression,
        "complexType": parse_complexType,
        "simpleType": parse_simpleType,
        "nativeType": parse_nativeType,
        "string": parse_string,
        "number": parse_number,
        "boolean": parse_boolean,
        "function": parse_function,
        "null": parse_null,
        "undefined": parse_undefined,
        "any": parse_any,
        "array": parse_array,
        "object": parse_object,
        "propertyAndType": parse_propertyAndType,
        "propertyName": parse_propertyName,
        "ctor": parse_ctor,
        "or": parse_or,
        "and": parse_and,
        "not": parse_not,
        "bracketed": parse_bracketed,
        "mandatoryParam": parse_mandatoryParam,
        "varargsParam": parse_varargsParam,
        "optionalParam": parse_optionalParam,
        "ws": parse_ws
      };
      
      if (startRule !== undefined) {
        if (parseFunctions[startRule] === undefined) {
          throw new Error("Invalid rule name: " + quote(startRule) + ".");
        }
      } else {
        startRule = "paramList";
      }
      
      var pos = 0;
      var reportFailures = 0;
      var rightmostFailuresPos = 0;
      var rightmostFailuresExpected = [];
      
      function padLeft(input, padding, length) {
        var result = input;
        
        var padLength = length - input.length;
        for (var i = 0; i < padLength; i++) {
          result = padding + result;
        }
        
        return result;
      }
      
      function escape(ch) {
        var charCode = ch.charCodeAt(0);
        var escapeChar;
        var length;
        
        if (charCode <= 0xFF) {
          escapeChar = 'x';
          length = 2;
        } else {
          escapeChar = 'u';
          length = 4;
        }
        
        return '\\' + escapeChar + padLeft(charCode.toString(16).toUpperCase(), '0', length);
      }
      
      function matchFailed(failure) {
        if (pos < rightmostFailuresPos) {
          return;
        }
        
        if (pos > rightmostFailuresPos) {
          rightmostFailuresPos = pos;
          rightmostFailuresExpected = [];
        }
        
        rightmostFailuresExpected.push(failure);
      }
      
      function parse_paramList() {
        var result0, result1, result2, result3, result4, result5, result6;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        result0 = parse_ws();
        if (result0 !== null) {
          result1 = parse_param();
          if (result1 !== null) {
            result2 = parse_ws();
            if (result2 !== null) {
              if (input.charCodeAt(pos) === 44) {
                result3 = ",";
                pos++;
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("\",\"");
                }
              }
              if (result3 !== null) {
                result4 = parse_ws();
                if (result4 !== null) {
                  result5 = parse_paramList();
                  if (result5 !== null) {
                    result6 = parse_ws();
                    if (result6 !== null) {
                      result0 = [result0, result1, result2, result3, result4, result5, result6];
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, p0, pn) { return [p0].concat(pn); })(pos0, result0[1], result0[5]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        if (result0 === null) {
          pos0 = pos;
          pos1 = pos;
          result0 = parse_ws();
          if (result0 !== null) {
            result1 = parse_param();
            if (result1 !== null) {
              result2 = parse_ws();
              if (result2 !== null) {
                result0 = [result0, result1, result2];
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, p0) { return [p0]; })(pos0, result0[1]);
          }
          if (result0 === null) {
            pos = pos0;
          }
        }
        return result0;
      }
      
      function parse_param() {
        var result0;
        
        result0 = parse_optionalParam();
        if (result0 === null) {
          result0 = parse_varargsParam();
          if (result0 === null) {
            result0 = parse_mandatoryParam();
          }
        }
        return result0;
      }
      
      function parse_expression() {
        var result0, result1;
        var pos0;
        
        pos0 = pos;
        if (/^[^}]/.test(input.charAt(pos))) {
          result1 = input.charAt(pos);
          pos++;
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[^}]");
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            if (/^[^}]/.test(input.charAt(pos))) {
              result1 = input.charAt(pos);
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[^}]");
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, chars) { return chars.join(''); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_complexType() {
        var result0;
        
        result0 = parse_or();
        if (result0 === null) {
          result0 = parse_and();
          if (result0 === null) {
            result0 = parse_simpleType();
          }
        }
        return result0;
      }
      
      function parse_simpleType() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
        result0 = parse_not();
        if (result0 === null) {
          pos0 = pos;
          pos1 = pos;
          result0 = parse_nativeType();
          if (result0 !== null) {
            result1 = parse_ws();
            if (result1 !== null) {
              if (input.substr(pos, 2) === "{{") {
                result2 = "{{";
                pos += 2;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"{{\"");
                }
              }
              if (result2 !== null) {
                result3 = parse_expression();
                if (result3 !== null) {
                  if (input.substr(pos, 2) === "}}") {
                    result4 = "}}";
                    pos += 2;
                  } else {
                    result4 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"}}\"");
                    }
                  }
                  if (result4 !== null) {
                    result0 = [result0, result1, result2, result3, result4];
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, type, expression) { type.expression = expression; return type; })(pos0, result0[0], result0[3]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          if (result0 === null) {
            result0 = parse_nativeType();
          }
        }
        return result0;
      }
      
      function parse_nativeType() {
        var result0;
        
        result0 = parse_string();
        if (result0 === null) {
          result0 = parse_number();
          if (result0 === null) {
            result0 = parse_boolean();
            if (result0 === null) {
              result0 = parse_function();
              if (result0 === null) {
                result0 = parse_null();
                if (result0 === null) {
                  result0 = parse_undefined();
                  if (result0 === null) {
                    result0 = parse_array();
                    if (result0 === null) {
                      result0 = parse_object();
                      if (result0 === null) {
                        result0 = parse_ctor();
                        if (result0 === null) {
                          result0 = parse_any();
                          if (result0 === null) {
                            result0 = parse_not();
                            if (result0 === null) {
                              result0 = parse_bracketed();
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      
      function parse_string() {
        var result0;
        var pos0;
        
        pos0 = pos;
        if (input.substr(pos, 6) === "string") {
          result0 = "string";
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"string\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 3) === "str") {
            result0 = "str";
            pos += 3;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"str\"");
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {return {name: 'string'}; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_number() {
        var result0;
        var pos0;
        
        pos0 = pos;
        if (input.substr(pos, 6) === "number") {
          result0 = "number";
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"number\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 3) === "num") {
            result0 = "num";
            pos += 3;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"num\"");
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {return {name: 'number'}; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_boolean() {
        var result0;
        var pos0;
        
        pos0 = pos;
        if (input.substr(pos, 7) === "boolean") {
          result0 = "boolean";
          pos += 7;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"boolean\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 4) === "bool") {
            result0 = "bool";
            pos += 4;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"bool\"");
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {return {name: 'boolean'}; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_function() {
        var result0;
        var pos0;
        
        pos0 = pos;
        if (input.substr(pos, 8) === "function") {
          result0 = "function";
          pos += 8;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"function\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 4) === "func") {
            result0 = "func";
            pos += 4;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"func\"");
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {return {name: 'function'}; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_null() {
        var result0;
        var pos0;
        
        pos0 = pos;
        if (input.substr(pos, 4) === "null") {
          result0 = "null";
          pos += 4;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"null\"");
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {return {name: 'null'}; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_undefined() {
        var result0;
        var pos0;
        
        pos0 = pos;
        if (input.substr(pos, 9) === "undefined") {
          result0 = "undefined";
          pos += 9;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"undefined\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 5) === "undef") {
            result0 = "undef";
            pos += 5;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"undef\"");
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {return {name: 'undefined'}; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_any() {
        var result0;
        var pos0;
        
        pos0 = pos;
        if (input.substr(pos, 3) === "any") {
          result0 = "any";
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"any\"");
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {return {name: 'any'};})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_array() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 91) {
          result0 = "[";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"[\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_ws();
          if (result1 !== null) {
            result2 = parse_complexType();
            if (result2 !== null) {
              result3 = parse_ws();
              if (result3 !== null) {
                if (input.charCodeAt(pos) === 93) {
                  result4 = "]";
                  pos++;
                } else {
                  result4 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"]\"");
                  }
                }
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, type) { return {name: 'array', elementType: type}; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_object() {
        var result0, result1, result2, result3, result4, result5, result6, result7, result8;
        var pos0, pos1, pos2;
        
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 123) {
          result0 = "{";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"{\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_ws();
          if (result1 !== null) {
            result2 = parse_propertyAndType();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result3 = parse_ws();
              if (result3 !== null) {
                result4 = [];
                pos2 = pos;
                result5 = parse_ws();
                if (result5 !== null) {
                  if (input.charCodeAt(pos) === 44) {
                    result6 = ",";
                    pos++;
                  } else {
                    result6 = null;
                    if (reportFailures === 0) {
                      matchFailed("\",\"");
                    }
                  }
                  if (result6 !== null) {
                    result7 = parse_ws();
                    if (result7 !== null) {
                      result8 = parse_propertyAndType();
                      if (result8 !== null) {
                        result5 = [result5, result6, result7, result8];
                      } else {
                        result5 = null;
                        pos = pos2;
                      }
                    } else {
                      result5 = null;
                      pos = pos2;
                    }
                  } else {
                    result5 = null;
                    pos = pos2;
                  }
                } else {
                  result5 = null;
                  pos = pos2;
                }
                while (result5 !== null) {
                  result4.push(result5);
                  pos2 = pos;
                  result5 = parse_ws();
                  if (result5 !== null) {
                    if (input.charCodeAt(pos) === 44) {
                      result6 = ",";
                      pos++;
                    } else {
                      result6 = null;
                      if (reportFailures === 0) {
                        matchFailed("\",\"");
                      }
                    }
                    if (result6 !== null) {
                      result7 = parse_ws();
                      if (result7 !== null) {
                        result8 = parse_propertyAndType();
                        if (result8 !== null) {
                          result5 = [result5, result6, result7, result8];
                        } else {
                          result5 = null;
                          pos = pos2;
                        }
                      } else {
                        result5 = null;
                        pos = pos2;
                      }
                    } else {
                      result5 = null;
                      pos = pos2;
                    }
                  } else {
                    result5 = null;
                    pos = pos2;
                  }
                }
                if (result4 !== null) {
                  result5 = parse_ws();
                  if (result5 !== null) {
                    if (input.charCodeAt(pos) === 125) {
                      result6 = "}";
                      pos++;
                    } else {
                      result6 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"}\"");
                      }
                    }
                    if (result6 !== null) {
                      result0 = [result0, result1, result2, result3, result4, result5, result6];
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, prop0, props) {
                var obj = {};
                if(typeof(prop0[0]) !== 'undefined'){
                    obj[prop0[0]] = prop0[1];
                }
                for(var i = 0; i < props.length; i+=1){
                  obj[props[i][3][0]] = props[i][3][1]
                }
                return {name: 'object', properties: obj};
            })(pos0, result0[2], result0[4]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_propertyAndType() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        result0 = parse_propertyName();
        if (result0 !== null) {
          result1 = parse_ws();
          if (result1 !== null) {
            if (input.charCodeAt(pos) === 58) {
              result2 = ":";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\":\"");
              }
            }
            if (result2 !== null) {
              result3 = parse_ws();
              if (result3 !== null) {
                result4 = parse_complexType();
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, prop, type) { return [prop, type] })(pos0, result0[0], result0[4]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_propertyName() {
        var result0, result1;
        var pos0;
        
        pos0 = pos;
        if (/^[a-zA-Z_$]/.test(input.charAt(pos))) {
          result1 = input.charAt(pos);
          pos++;
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[a-zA-Z_$]");
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            if (/^[a-zA-Z_$]/.test(input.charAt(pos))) {
              result1 = input.charAt(pos);
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[a-zA-Z_$]");
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, chars) {return chars.join('')})(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_ctor() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        if (/^[A-Z]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[A-Z]");
          }
        }
        if (result0 !== null) {
          result1 = [];
          if (/^[a-zA-Z0-9_$]/.test(input.charAt(pos))) {
            result2 = input.charAt(pos);
            pos++;
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[a-zA-Z0-9_$]");
            }
          }
          while (result2 !== null) {
            result1.push(result2);
            if (/^[a-zA-Z0-9_$]/.test(input.charAt(pos))) {
              result2 = input.charAt(pos);
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("[a-zA-Z0-9_$]");
              }
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, first, rest) {return  {name: 'namedObject', ctorName: [first].concat(rest).join('')}; })(pos0, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_or() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        result0 = parse_simpleType();
        if (result0 !== null) {
          result1 = parse_ws();
          if (result1 !== null) {
            if (input.charCodeAt(pos) === 124) {
              result2 = "|";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"|\"");
              }
            }
            if (result2 !== null) {
              result3 = parse_ws();
              if (result3 !== null) {
                result4 = parse_complexType();
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, left, right) {return {name: 'or', left: left, right: right}; })(pos0, result0[0], result0[4]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_and() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        result0 = parse_simpleType();
        if (result0 !== null) {
          result1 = parse_ws();
          if (result1 !== null) {
            if (input.charCodeAt(pos) === 38) {
              result2 = "&";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"&\"");
              }
            }
            if (result2 !== null) {
              result3 = parse_ws();
              if (result3 !== null) {
                result4 = parse_complexType();
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, left, right) {return {name: 'and', left: left, right: right}; })(pos0, result0[0], result0[4]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_not() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 33) {
          result0 = "!";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"!\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_ws();
          if (result1 !== null) {
            result2 = parse_simpleType();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, type) {return {name: 'not', type: type};})(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_bracketed() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 40) {
          result0 = "(";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"(\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_ws();
          if (result1 !== null) {
            result2 = parse_complexType();
            if (result2 !== null) {
              result3 = parse_ws();
              if (result3 !== null) {
                if (input.charCodeAt(pos) === 41) {
                  result4 = ")";
                  pos++;
                } else {
                  result4 = null;
                  if (reportFailures === 0) {
                    matchFailed("\")\"");
                  }
                }
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, type) { return type; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_mandatoryParam() {
        var result0;
        var pos0;
        
        pos0 = pos;
        result0 = parse_complexType();
        if (result0 !== null) {
          result0 = (function(offset, type) {return {name: 'mandatoryParam', type: type, mandatory: true, optional: false, varargs: false};})(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_varargsParam() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        result0 = parse_complexType();
        if (result0 !== null) {
          result1 = parse_ws();
          if (result1 !== null) {
            if (input.charCodeAt(pos) === 42) {
              result2 = "*";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"*\"");
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, type) {return {name: 'varargsParam', type: type, mandatory: false, optional: false, varargs: true};})(pos0, result0[0]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_optionalParam() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = pos;
        pos1 = pos;
        result0 = parse_complexType();
        if (result0 !== null) {
          result1 = parse_ws();
          if (result1 !== null) {
            if (input.charCodeAt(pos) === 63) {
              result2 = "?";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"?\"");
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, type) { return {name: 'optionalParam', type: type, mandatory: false, optional: true, varargs: false};})(pos0, result0[0]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      
      function parse_ws() {
        var result0, result1;
        
        result0 = [];
        if (input.charCodeAt(pos) === 32) {
          result1 = " ";
          pos++;
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("\" \"");
          }
        }
        while (result1 !== null) {
          result0.push(result1);
          if (input.charCodeAt(pos) === 32) {
            result1 = " ";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\" \"");
            }
          }
        }
        return result0;
      }
      
      
      function cleanupExpected(expected) {
        expected.sort();
        
        var lastExpected = null;
        var cleanExpected = [];
        for (var i = 0; i < expected.length; i++) {
          if (expected[i] !== lastExpected) {
            cleanExpected.push(expected[i]);
            lastExpected = expected[i];
          }
        }
        return cleanExpected;
      }
      
      function computeErrorPosition() {
        /*
         * The first idea was to use |String.split| to break the input up to the
         * error position along newlines and derive the line and column from
         * there. However IE's |split| implementation is so broken that it was
         * enough to prevent it.
         */
        
        var line = 1;
        var column = 1;
        var seenCR = false;
        
        for (var i = 0; i < Math.max(pos, rightmostFailuresPos); i++) {
          var ch = input.charAt(i);
          if (ch === "\n") {
            if (!seenCR) { line++; }
            column = 1;
            seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            line++;
            column = 1;
            seenCR = true;
          } else {
            column++;
            seenCR = false;
          }
        }
        
        return { line: line, column: column };
      }
      
      
      var result = parseFunctions[startRule]();
      
      /*
       * The parser is now in one of the following three states:
       *
       * 1. The parser successfully parsed the whole input.
       *
       *    - |result !== null|
       *    - |pos === input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 2. The parser successfully parsed only a part of the input.
       *
       *    - |result !== null|
       *    - |pos < input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 3. The parser did not successfully parse any part of the input.
       *
       *   - |result === null|
       *   - |pos === 0|
       *   - |rightmostFailuresExpected| contains at least one failure
       *
       * All code following this comment (including called functions) must
       * handle these states.
       */
      if (result === null || pos !== input.length) {
        var offset = Math.max(pos, rightmostFailuresPos);
        var found = offset < input.length ? input.charAt(offset) : null;
        var errorPosition = computeErrorPosition();
        
        throw new this.SyntaxError(
          cleanupExpected(rightmostFailuresExpected),
          found,
          offset,
          errorPosition.line,
          errorPosition.column
        );
      }
      
      return result;
    },
    
    /* Returns the parser source code. */
    toSource: function() { return this._source; }
  };
  
  /* Thrown when a parser encounters a syntax error. */
  
  result.SyntaxError = function(expected, found, offset, line, column) {
    function buildMessage(expected, found) {
      var expectedHumanized, foundHumanized;
      
      switch (expected.length) {
        case 0:
          expectedHumanized = "end of input";
          break;
        case 1:
          expectedHumanized = expected[0];
          break;
        default:
          expectedHumanized = expected.slice(0, expected.length - 1).join(", ")
            + " or "
            + expected[expected.length - 1];
      }
      
      foundHumanized = found ? quote(found) : "end of input";
      
      return "Expected " + expectedHumanized + " but " + foundHumanized + " found.";
    }
    
    this.name = "SyntaxError";
    this.expected = expected;
    this.found = found;
    this.message = buildMessage(expected, found);
    this.offset = offset;
    this.line = line;
    this.column = column;
  };
  
  result.SyntaxError.prototype = Error.prototype;
  
  return result;
})(); 
 
 // END GENERATED PARSER
        }).call(parserHolder);

    }).call(this);

}).call(this);
