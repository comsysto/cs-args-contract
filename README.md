cs-args-contract
================

This library is used to check the arguments of a javascript function against a contract that is defined as a string.

# Motivation #

Don't you wish you could specify some kind of a method signiture in javascript. So you can be sure that the arguments
that you process are of the type you expect or even are specified?

I often found myself checking input parameter for sanity especially on module borders. Trying to catch this undefined
value before it found its way deeper into the system and you run into a 'undefiend is not a function' error and you
have no idea where this value have sneaked in.

So I take a little inspiration from the JsDocs syntax for describing types in a way you don't loose the flexibility of
a dynamic typed language.

# Usage #

    function sayHello(name){
        argsContract(arguments, 'str');
        ...
    }

    function sayHelloNTimes(name, times){
        argsContract(arguments, 'str, num');
        ...
    }

    /**
     * Adds a handler for module with name 'name'.
     * If the handler is not supplied a already handler already registered is removed.
     * The handler can be object that has the 'activate' and 'deactivate' function or a simple function.
     */
    function setHandler(name, handler?){
        argsContract(arguments, 'str, {activate: func, deactivate: func} | func');
        ...
    }

Some examples for possible contract strings:
* __'str'__: the argument must be a string
* __'num'__: the argument must be a number
* __'str, num'__: first argument must be a string, the second argument must be a number
* __'str | num'__: the argument must be a string or a number
* __'str | \[str\]'__: the argument must be string or an array that contains only strings
* __'\[str | num\]'__: the argument must be an array that can contain strings or numbers.
* __'str, num*'__: the first argument must be a string, all following arguments must be numbers.
* __'str, num?'__: the first argument must be a string, the second argument is optional but must be a number if present.
* __'{}'__: the argument must be an object.
* __'{name: string}'__: the argument must be an object and must have a property called 'name' that has a string value.
* __'{name: string, index: num | undef}'__: the argument must be an object and must have a property called 'name' that
 has a string value and a optional property named index that must be a number if present.
* __'Customer'__: the argument must be an object who's constructor name is 'Customer'

The examples above can be combined in any way.
Here a more formal description of the type expressions:
* __str, string__: a string
* __num, number__: a number
* __bool, boolean__: a boolean
* __fun, function__: a function
* __null__: the null value
* __undef, undefined__: the undefined value
* __any__: will match any parameter
* __\[ TYPE \]__: an array of elements of TYPE
* __TYPE_A | TYPE_B__: TYPE_A or TYPE_B
* __{ PROP: TYPE, ... }__: An object that must contain a property named PROP that has a value of type TYPE
* __CTOR_NAME__: The name of a constructor function. The name must start with a capital letter.
* __! TYPE__: Not the type TYPE
* __TYPE_A & TYPE_B__: argument has to met type expression TYPE_A and TYPE_B,
quite academic but can be used with Ctors and Object or with not in a sane way.

For each parameter a type must be specified in addition the following modifier for parameters are available:
* __TYPE ?__: The parameter is optional
* __TYPE \* __: The parameter is a vararg

The following rules apply to the above modifiers:
* Vararg and optional parameter can't be used together in one parameter list.
* Only one parameter can be declared vararg in a parameter list.
* All optional parameters have to be in a row.
* Optinal parameter are matched from left to right.



# Licences #
cs-args-contract is provided under the [Apache Licence Version 2](https://github.com/okrammer/cs-args-contract/blob/master/LICENSE.txt)

cs-args-contract uses a parser that is generated with the awsome [PEG.js](http://pegjs.majda.cz/) parser generator.
