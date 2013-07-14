cs-args-contract
================

This library is used to check the arguments of a javascript function against a contract that is defined as a string.
Some examples for possible contract strings:
* 'str' -> the argument must be a string
* 'num' -> the argument must be a number
* 'str, num' -> first argument must be a string, the second argument must be a number
* 'str | num' -> the argument must be a string or a number
* 'str | \[str\]' -> the argument must be string or an array that contains only strings
* '\[str | num\]' -> the argument must be an array that can contain strings or numbers.
* 'str, num*' -> the first argument must be a string, all following arguments must be numbers.
* 'str, num?' -> the first argument must be a string, the second argument is optional but must be a number if present.
* '{}' -> the argument must be an object.
* '{name: string}' -> the argument must be an object and must have a property called 'name' that has a string value.
* '{name: string, index: num | undef}' -> the argument must be an object and must have a property called 'name' that
 has a string value and a optional property named index that must be a number if present.
* 'Customer' -> the argument must be an object who's constructor name is 'Customer'

The examples above can be combined in any way.
Here a more formal description of the type expressions:
* str, string -> a string
* num, number -> a number
* bool, boolean -> a boolean
* fun, function -> a function
* null -> the null value
* undef, undefined -> the undefined value
* any -> will match any parameter
* \[ TYPE \] -> an array of elements of TYPE
* TYPE_A | TYPE_B -> TYPE_A or TYPE_B
* { PROP: TYPE, ... } -> An object that must contain a property named PROP that has a value of type TYPE
* CTOR_NAME -> The name of a constructor function. The name must start with a capital letter.
* ! TYPE -> Not the type TYPE
* TYPE_A & TYPE_B -> argument has to met type expression TYPE_A and TYPE_B,
quite academic but can be used with Ctors and Object or with not in a sane way.

For each parameter a type must be specified in addition the following modifier for parameters are available:
* TYPE ? -> The parameter is optional
* TYPE * -> The parameter is a vararg

The following rules apply to the above modifiers:
* Vararg and optional parameter can't be used together in one parameter list.
* Only one parameter can be declared vararg in a parameter list.
* All optional parameters have to be in a row.
* Optinal parameter are matched from left to right.



# Licences #
cs-args-contract is provided under the [Apache Licence Version 2](https://github.com/okrammer/cs-args-contract/blob/master/LICENSE.txt)

cs-args-contract uses a parser that is generated with the awsome [PEG.js](http://pegjs.majda.cz/) parser generator.

# Usage #


    function checkCustomer(customer, rules, notifier){
        argsContract(arguments, '{name: str, newsletter: bool}, [{ruleName: str, checker: func}], func?');
        // do something useful ...
    }

    checkCustomer({name: 'Peter', newsletter: true}, []); // okey
    checkCustomer({name: 'Peter', newsletter: true, age: 15}, [{ruleName: ageRule, function(){}}]); // okey
    checkCustomer({name: 'Peter', newsletter: 'true', age: 15}, []); // fail
    checkCustomer({name: 'Peter', newsletter: 'true'}, ['string]); // fail
    checkCustomer({name: 'Peter', age: 15}, []); // fail
    // etc...