var cs_args_contract_factory = (function() {

    function parser() {
        return window.cs_args_contract_parser;
    }

    var checkerForType = {

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
            return checkType(type.left, arg) || checkType(type.right, arg);
        },

        array: function(type, arg) {
            return _.isArray(arg) && _.every(arg, function(value) {
                return checkType(type.elementType, value);
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
                    if (!checkType(propType, propValue)) {
                        return false;
                    }
                }
            }
            return true;
        },

        namedObject: function(type, arg) {
            return _.isObject(arg) && arg.constructor && arg.constructor.name === arg.ctorName;
        }

    };


    function checkType(type, arg) {
        var checker = checkerForType[type.name];
        return checker(type, arg);
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
        function splitParts() {
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

        function errorIllegalArgCount() {
            throw new ContractViolation("ARG_COUNT");
        }

        function checkVarargs(args, paramContracts, indexOffset) {
            var typeOfVarargs = paramContracts[0].type;
            _(args).each(function(arg, index) {
                var result = checkType(typeOfVarargs, arg);
                if (!result) {
                    throw new ContractViolation(indexOffset + index + 1);
                }
            });

        }

        function checkOptional(args, paramContracts, indexOffset) {
            _(args).each(function(arg, index) {
                var contract = paramContracts[index];
                var result = checkType(contract.type, arg);
                if (!result) {
                    throw new ContractViolation(indexOffset + index + 1);
                }
            });
            return null;
        }

        function checkMandatory(args, paramContracts, indexOffset) {
            _(paramContracts).each(function(contract, index) {
                var arg = args[index];
                var result = checkType(contract.type, arg);
                if (!result) {
                    throw new ContractViolation(indexOffset + index + 1);
                }
            });
        }

        var parts = splitParts();
        var contractPart1 = parts[0];
        var contractPart2 = parts[1];
        var contractPart3 = parts[2];

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
        this.code = code.toString();
    }

    /**
     * A instance of the ctor is thrown if the arguments don't match the contract.
     *
     * @param {string|number} code possible codes are ARG_COUNT or the index of the argument that failed the test.
     * @constructor
     */
    function ContractViolation(code) {
        this.name = "ContractViolation";
        this.code = code.toString();
    }


    function Instance(){

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

            if (_.isUndefined(parser()) || _.isNull(parser())) {
                throw new ContractError("NO_PARSER_FOUND");
            }
            try {
                var trimmedString = contractString.replace(/\s/g, "");
                var baseContract = parser().parse(trimmedString);
            } catch (e) {
                throw new ContractError("SYNTAX_ERROR");
            }

            contract = new Contract(baseContract, contractString);
            contractCache[contractString] = contract;
            return contract;
        }


        function checkArgs(argList, contractString) {
            var contract = getContract(contractString);
            contract.checkArgs(_.toArray(argList));
        }


        this._cache = contractCache;
        this.assert = checkArgs;
        this.validate = function(argList, contract) {
            try {
                checkArgs(argList, contract);
            } catch (e) {
                if(e.name === 'ContractError' || e.name === 'ContractViolation')
                    return e;
                throw e;
            }
            return null;
        }
    }

    return function(){
        return new Instance();
    }

})();

(function(){
    var originalReference = this.argsContract;
    this.argsContract = cs_args_contract_factory().assert;
    this.argsContract.noConflict = function(){
        if(_.isUndefined(originalReference)){
            this.argsContract = undefined;
            try{
                delete this.argsContract;
            }catch(e){
                // weird ie bug throws exception on deleting stuff from window
            }
        }
        this.argsContract = originalReference;
    };
}).call(this);