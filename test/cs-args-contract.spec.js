describe('cs-args-contract', function() {
    'use strict';

    var testee;
    beforeEach(function() {
        testee = argsContract.factory();
    });

    function valid() {
        // don't throw anything ;)
        testee.apply(null, arguments);
    }

    function contractViolation(){
        var result = null;
        var testeeArgs = _(arguments).toArray().slice(0, arguments.length -1 );
        try{
            testee.apply(null, testeeArgs);
        }catch(e){
            result = e;
        }
        expect(result).not.toBeNull();
        expect(result.name).toBe("ContractViolation");
        expect(result.code).toBe(arguments[arguments.length - 1]);
    }

    function contractError() {
        var result = null;
        var testeeArgs = _(arguments).toArray().slice(0, arguments.length -1 );
        try{
            testee.apply(null, testeeArgs);
        }catch(e){
            result = e;
        }
        expect(result).not.toBeNull();
        expect(result.name).toBe("ContractError");
        expect(result.code).toBe(arguments[arguments.length - 1]);
    }

    it('registers a global instance', function() {
        expect(argsContract).toBeDefined();
    });

    it('can check varargs', function() {
        valid(['blub', 'bb', 'cc'], 'str*');
        valid(['blub', 'bb', 'cc'], 'str*, str');
        valid(['blub', 'bb', 'cc'], 'str, str*');
        valid(['blub', 'bb', 'cc'], 'str, str*, str');
        valid(['blub', 'cc'], 'str, str*, str');
        contractViolation(['blub', 'cc'], 'str, str, str*, str', 'ARG_COUNT');
        contractViolation(['blub', 'cc', 'str', true], 'str*', 4);
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
        contractViolation(['blub', true], 'str,str', 2);
        contractViolation(['blub', 2], 'str,str', 2);
        contractViolation(['blub', null], 'str,str', 2);
        contractViolation(['blub', undefined], 'str,str', 2);
        contractViolation(['blub', []], 'str,str', 2);
        contractViolation(['blub', ['blub']], 'str,str', 2);
        contractViolation(['blub', {}], 'str,str', 2);
    });

    it('can check numbers', function() {
        valid([1, 2], 'num,num');
        contractViolation([1, true], 'num,num', 2);
        contractViolation([1, 'str'], 'num,num', 2);
        contractViolation([1, null], 'num,num', 2);
        contractViolation([1, undefined], 'num,num', 2);
        contractViolation([1, []], 'num,num', 2);
        contractViolation([1, [1]], 'num,num', 2);
        contractViolation([1, {}], 'num,num', 2);
    });

    it('can check date', function() {
        valid([new Date()], 'date');
        contractViolation([1, true], 'num,date', 2);
        contractViolation([1, 'str'], 'num,date', 2);
        contractViolation([1, null], 'num,date', 2);
        contractViolation([1, undefined], 'num,date', 2);
        contractViolation([1, []], 'num,date', 2);
        contractViolation([1, [new Date()]], 'num,date', 2);
        contractViolation([1, {}], 'num,date', 2);
    });

    it('can check regexp', function() {
        valid([new RegExp('.*')], 'regexp');
        valid([/.*/], 'regex');
        contractViolation([1, true], 'num,regex', 2);
        contractViolation([1, 'str'], 'num,regex', 2);
        contractViolation([1, null], 'num,regex', 2);
        contractViolation([1, undefined], 'num,regex', 2);
        contractViolation([1, []], 'num,regex', 2);
        contractViolation([1, [/./]], 'num,regex', 2);
        contractViolation([1, {}], 'num,regex', 2);
    });


    it('can check functions', function() {
        function f() {
        }

        valid([1, f], 'num,func');
        valid([1, f], 'num,function');
        contractViolation([1, true], 'num,func', 2);
        contractViolation([1, {}], 'num,func', 2);
    });

    it('can check objects', function() {
        valid([{}], '{}');
        valid([{name: 'peter'}], '{}');
        valid([{name: 'peter'}], '{name: str}');
        contractViolation([{}], '{name: str}', 1);
    });

    it('can check hashes', function() {
        valid([{}], '{* : str}');
        valid([{one: 1, two: 2, three: 3}], '{*: num}');
        valid([{'peter': {name: 'peter'}, 'hans': {name: 'hans'}}], '{* : {name: str}}');
        contractViolation([{one: '1', two: 2}], '{*: str}', 1);
    });

    it('can check constructors', function() {
        function Customer() {
        }
        function f(){
        }

        var NoNamedCtor = function(){};

        valid([4, new Customer()], 'num,Customer');
        contractViolation([1, f], 'num,Customer', 2);
        contractViolation([1, {}], 'num,Customer', 2);
        // Can't check this because the function has no name...
        contractViolation([1, new NoNamedCtor()], 'num, NoNamedCtor', 2);
    });

    it('can check constructors with inheritance', function() {
        function Human() {
        }

        function Customer() {
            Human.call(this);
        }

        Customer.prototype = Object.create(Human.prototype);
        Customer.prototype.constructor = Customer;

        function Animal() {
        }

        valid([new Customer()], 'Customer');
        valid([new Customer()], 'Human');
        valid([new Human()], 'Human');

        contractViolation([new Human()], 'Customer', 1);
        contractViolation([new Animal()], 'Human', 1);

    });

    it('can negate types', function() {
        valid([4], '!str');
        valid([4], '!bool');
        valid([4], '! null | undefined');
        valid([4], 'str | ! null | undefined');
        valid(['sss'], 'str | ! null | undefined');
        contractViolation([null], 'str | ! null | undefined', 1);
        valid([undefined], 'str | ! null | undefined');
        contractViolation(['str'], '!str', 1);
        contractViolation([null], '!null', 1);
        contractViolation([undefined], '!undef', 1);
    });

    it('can use () to change priority', function() {
        valid(['blub'], '! null | undefined');
        contractViolation([null], '! (null | undefined)', 1);
        contractViolation([undefined], '! (null | undefined)', 1);
    });

    it('can use & for academic purpose', function() {
        valid(['blbbb'], '!null & !undefined');
        contractViolation([null], '!null & !undefined', 1);
        contractViolation([undefined], '!null & !undefined', 1);

        function Customer(name) {
            this.name = name;
        }
        valid([new Customer('hans')], 'Customer & {name: string}');
        contractViolation([new Customer(3)], 'Customer & {name: string}', 1);
        contractViolation([{name: 'hans'}], 'Customer & {name: string}', 1);

    });

    it('can evaluate different style of arrays', function() {
        valid([[4, 3, 4]],          '[num]{{$$.length > 2}} | (string | num)[]{{ true }}');
        valid([["5", 3]],           '[num]{{$$.length > 2}} | (string | num)[]{{ true }}');
        contractViolation([[true, 3]], '[num]{{$$.length > 2}} | (string | num)[]{{ true }}', 1);
    });

    it('can evaluate expressions', function() {
        valid([1, 3], 'num{{$$ < 2}}, num{{$$ > 2}}');
        contractViolation([2, 3], 'num{{$$ < 2}}, num{{$$ > 2}}', 1);
        valid([[2, 3, 4, 5, 6], "blub"], '[num{{$$ < 10}}], str{{$$.indexOf("b") === 0}}');
        contractViolation([[2, 3, 4, 5, 6, 10], "blub"], '[num{{$$ < 10}}], str{{$$.indexOf("b") === 0}}', 1);
        contractViolation([[2, 3, 4, 5, 6], "lub"], '[num{{$$ < 10}}], str{{$$.indexOf("b") === 0}}', 2);
    });

    it('can evaluate argList expressions', function() {
        valid([2, 3], 'num{{$$ % 2 === 0}}, num{{$$ % 2 === 1}}', '$1 < $2');
        contractViolation([4, 3], 'num{{$$ % 2 === 0}}, num{{$$ % 2 === 1}}', '$1 < $2', 'EXPRESSION_ARGS');
        contractViolation([2, 9], 'num{{$$ % 2 === 0}}, num{{$$ % 2 === 1}}', '$1 < $2', '$1 + $2 < 10', 'EXPRESSION_ARGS');
        valid([2, 7], 'num{{$$ % 2 === 0}}, num{{$$ % 2 === 1}}', '$1 < $2', '$1 + $2 < 10');
    });

    it('can evaluate expressions with special functions', function() {
        valid([[2, 3, 4, 5, 6], "blub"], '[num]{{len() < 6}}, str');
        contractViolation([[2, 3, 4, 5, 6, 10], "blub"], '[num]{{len() < 6}}, str', 1);
        valid([[2, 3, 4, 5, 6], "blub"], '[num], str{{re(/^b.*/)}}');
        contractViolation([[2, 3, 4, 5, 6], "lub"], '[num], str {{ re("^b.*/") }}', 2);
    });

    it('can evaluate expressions with the oneOf function', function() {
        valid([[2, 3, 4, 2, 4], "blub"], '[num {{ oneOf(2, 3, 4) }}], str');
        contractViolation([[2, 3, 4, 5, 6, 10], "blub"], '[num {{ oneOf(2, 3, 4)}} ], str', 1);
        valid([['a', 'b', 'a', 'b', 'b'], "blub"], '[ string {{ oneOf("a", "b") }} ], str');
        contractViolation([['a', 'b', 'a', 'c', 'b'], "blub"], '[ string {{ oneOf("a", "b") }} ], str', 1);
    });



    it('can complicated stuff', function() {
        var contract = 'num, str | [ {name: str, age:number} | {alias: string | {name: string}} ], bool?, number?';
        valid([1, "blub"], contract);
        valid([1, "blub", true], contract);
        valid([1, []], contract);
        contractViolation([1, [
            {name: "blub"}
        ], true], contract, 2);
        valid([1, [
            {name: "blub", age: 13}
        ], true], contract);
        valid([1, [
            {name: "blub", age: 13},
            {name: "blub", age: 13, height: 1.5}
        ], true], contract);
        valid([1, [
            {name: "blub", age: 13},
            {alias: 'batman'}
        ], true], contract);
        valid([1, [
            {name: "blub", age: 13},
            {alias: {name: 'batman', color: 'black'}}
        ], true], contract);
        contractViolation([1, [
            {name: "blub", age: 13},
            {alias: {name: 3, color: 'black'}}
        ], true], contract, 2);
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
        expect(_.keys(testee._cache).length).toBe(0);
        contractError([], 'str*, str*, str', "MULTIPLE_VARARGS");

        expect(_.keys(testee._cache).length).toBe(0);
        valid(['blub'], 'str, str?, str?');
        expect(_.keys(testee._cache).length).toBe(1);
        valid(['blub'], 'str, str?, str?');
        expect(_.keys(testee._cache).length).toBe(1);

        valid(['blub'], 'str?, str?, str?');
        expect(_.keys(testee._cache).length).toBe(2);
        valid(['blub'], 'str?, str?, str?');
        expect(_.keys(testee._cache).length).toBe(2);

        // we cache the not trimmed string variant
        valid(['blub'], 'str?,str?,str?');
        expect(_.keys(testee._cache).length).toBe(3);

    });

    it('should throw a exception', function() {
        function f() {
            f.assert(arguments, 'num, str | bool');
        }

        expect(function() {
            f(1, 1);
        }).toThrow();

    });

    it('can handle real <arguments> objects', function() {
        function f() {
            valid(arguments, 'str, str?, str');
        }

        f('a', 'b');
        f('a', 'b', 'c');
    });

});
