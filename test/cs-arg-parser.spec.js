describe('cs-args-contract', function() {
    'use strict';

    var checkArgs;
    beforeEach(function(){
        checkArgs = cs_args_contract_factory();
    });

    function valid(args, contract){
        expect(checkArgs.validate(args, contract)).toBeNull();
    }

    function contractViolation(args, contract, code){
        var result = checkArgs.validate(args, contract);
        expect(result).not.toBeNull();
        expect(result.name).toBe("ContractViolation");
        expect(result.code).toBe(code);
    }

    function contractError(args, contract, code){
        var result = checkArgs.validate(args, contract);
        expect(result).not.toBeNull();
        expect(result.name).toBe("ContractError");
        expect(result.code).toBe(code);
    }


    it('can check varargs', function() {
        valid(['blub', 'bb', 'cc'], 'str*');
        valid(['blub', 'bb', 'cc'], 'str*, str');
        valid(['blub', 'bb', 'cc'], 'str, str*');
        valid(['blub', 'bb', 'cc'], 'str, str*, str');
        valid(['blub',  'cc'], 'str, str*, str');
        contractViolation(['blub',  'cc'], 'str, str, str*, str', 'ARG_COUNT');
        contractViolation(['blub', 'cc', 'str', true], 'str*', '4');
        valid(['blub', 'bb', 'bb', 'bb', 'cc'], 'str,str*,str');
    });

    it('can check optional arguments', function() {

        contractViolation(['blub', 'cc', 'str'], 'str?,str', 'ARG_COUNT');
        valid(['blub', 'cc', 'str'], 'str,str?,str');
        valid(['blub', 'cc', 'str'], 'str,str?,str?,str');
        valid(['blub', 'cc', 'dd', 'str'], 'str,str?,str?,str');
        valid(['blub', 'cc'], 'str?,str');
        valid(['cc'], 'str?,str');
    });

    it('can check strings', function() {
        valid(['blub', 'blubb'], 'str,str');
       contractViolation(['blub', true], 'str,str', "2");
       contractViolation(['blub', 2], 'str,str', "2");
       contractViolation(['blub', null], 'str,str', "2");
       contractViolation(['blub', undefined], 'str,str', "2");
       contractViolation(['blub', []], 'str,str', "2");
       contractViolation(['blub', ['blub']], 'str,str', "2");
       contractViolation(['blub', {}], 'str,str', "2");
    });

    it('can check numbers', function() {
        valid([1, 2], 'num,num');
        contractViolation([1, true], 'num,num', "2");
        contractViolation([1, 'str'], 'num,num', "2");
        contractViolation([1, null], 'num,num', "2");
        contractViolation([1, undefined], 'num,num', "2");
        contractViolation([1, []], 'num,num', "2");
        contractViolation([1, [1]], 'num,num', "2");
        contractViolation([1, {}], 'num,num', "2");
    });

    it('can check functions', function() {
        function f(){
        }
        valid([1, f], 'num,func');
        valid([1, f], 'num,function');
        contractViolation([1, true], 'num,func', "2");
        contractViolation([1, {}], 'num,func', "2");
    });

    it('can complicated stuff', function() {
        var contract = 'num, str | [ {name: str, age:number} | {alias: string | {name: string}} ], bool?, number?';
        valid([1, "blub"], contract);
        valid([1, "blub", true], contract);
        valid([1, []], contract);
        contractViolation([1, [{name: "blub"}], true], contract, "2");
        valid([1, [{name: "blub", age: 13}], true], contract);
        valid([1, [{name: "blub", age: 13}, {name: "blub", age: 13, height: 1.5}], true], contract);
        valid([1, [{name: "blub", age: 13}, {alias: 'batman'}], true], contract);
        valid([1, [{name: "blub", age: 13}, {alias: {name: 'batman', color: 'black'}}], true], contract);
        contractViolation([1, [{name: "blub", age: 13}, {alias: {name: 3, color: 'black'}}], true], contract, "2");
    });

    it('can only parse one not mandatory part', function() {
        contractError([], 'str, str?, str, str?', "VARARGS_OR_OPTIONAL_NOT_IN_ROW");
        contractError([], 'str?, str, str, str?', "VARARGS_OR_OPTIONAL_NOT_IN_ROW");
        contractError([], 'str*, str, str, str?', "VARARGS_OR_OPTIONAL_NOT_IN_ROW");
    });

    it('don\t parse varags and optional', function() {
        contractError([], 'str, str*, str?, str', "VARARGS_AND_OPTIONAL");
        contractError([], 'str*, str?, str', "VARARGS_AND_OPTIONAL");
        contractError([], 'str, str*, str?', "VARARGS_AND_OPTIONAL");
    });

    it('don\t parse one varags', function() {
        contractError([], 'str*, str*, str', "MULTIPLE_VARARGS");
        contractError([], 'str, str*, str*', "MULTIPLE_VARARGS");
        contractError([], 'str, str*, str*, str', "MULTIPLE_VARARGS");
    });

    it('should cache contracts', function() {
        // we don't cache invalid contracts
        expect(_.keys(checkArgs._cache).length).toBe(0);
        contractError([], 'str*, str*, str', "MULTIPLE_VARARGS");

        expect(_.keys(checkArgs._cache).length).toBe(0);
        valid(['blub'], 'str, str?, str?');
        expect(_.keys(checkArgs._cache).length).toBe(1);
        valid(['blub'], 'str, str?, str?');
        expect(_.keys(checkArgs._cache).length).toBe(1);

        valid(['blub'], 'str?, str?, str?');
        expect(_.keys(checkArgs._cache).length).toBe(2);
        valid(['blub'], 'str?, str?, str?');
        expect(_.keys(checkArgs._cache).length).toBe(2);

        // we cache the not trimmed string variant
        valid(['blub'], 'str?,str?,str?');
        expect(_.keys(checkArgs._cache).length).toBe(3);

    });

    it('should throw a exception', function() {
        function f(){
            checkArgs.assert(arguments, 'num, str | bool');
        }

        expect(function(){
            f(1, 1);
        }).toThrow();

    });

    it('can handle real <arguments> objects', function() {
        function f(){
            valid(arguments, 'str, str?, str');
        }

        f('a', 'b');
        f('a', 'b', 'c');
    });

    it('registers a global instance', function() {
        expect(argsContract).toBeDefined();
    });


});
