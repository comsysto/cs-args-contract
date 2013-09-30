cs-args-contract
================

This library is used to check the arguments of a javascript function against a contract.

# Motivation #

Don't you wish you could specify some kind of a method signature in javascript? So you can make sure that the arguments
you are processing are of the types you expect them to be or even are defined?

I often caught myself checking input parameter for sanity especially on module boundaries, trying to catch this 'undefined'
value before it would find its way deeper into the system and you would run into an 'undefined is not a function' error
or something like this with no idea where this wrong value have sneaked in.

So I borrowed some ideas from the whole 'Programming by Contract' thing and took a little inspiration from the JsDocs
syntax in order to describe types in a way you don't loose the flexibility of a dynamic typed language and voilà we
have this little cutie ...

# Usage Examples#
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
     * If the handler is not supplied, an already registered handler with the name 'name' is removed.
     * The handler can be an object that has the 'activate' and 'deactivate' function or a function.
     */
    function setHandler(name, handler){
        argsContract(arguments, 'str, {activate: func, deactivate: func}|func ?');
        ...
    }

See some more examples for contract strings:

+ __'str'__: the argument must be a string
+ __'num'__: the argument must be a number
+ __'str, num'__: first argument must be a string, the second argument must be a number
+ __'str | num'__: the argument must be a string or a number
+ __'str | \[str\]'__: the argument must be string or an array that contains only strings
+ __'\[str | num\]'__: the argument must be an array that can contain strings or numbers.
+ __'str, num*'__: the first argument must be a string, all following arguments must be numbers.
+ __'str, num?'__: the first argument must be a string, the second argument is optional but must be a number if present.
+ __'{}'__: the argument must be an object.
+ __'{name: string}'__: the argument must be an object and must have a property called 'name' that has a string value.
+ __'{name: string, index: num | undef}'__: the argument must be an object and must have a property called 'name' that
 has a string value and a optional property named index that must be a number if present.
+ __'Customer'__: the argument must be an object who's constructor name is 'Customer'

The examples above can be combined in any way.

# Reference #
### Simple Types ###

+ __str, string__: a string
+ __num, number__: a number
+ __bool, boolean__: a boolean
+ __fun, function__: a function
+ __date__: a Date object
+ __regexp, regex: a RegExp object
+ __null__: the null value
+ __undef, undefined__: the undefined value
+ __any__: will match any parameter
+ __\[ TYPE \]__: an array of elements of TYPE
+ __{ PROP: TYPE, ... }__: An object that must contain a property named PROP that has a value of type TYPE
+ **CTOR_NAME**: The name of a constructor function. The name must start with a capital letter.
+ __( TYPE )__: You can use brackets to group type expressions.

### Complex Types ###

+ **TYPE\_A | TYPE\_B**: TYPE\_A or TYPE\_B
+ **! TYPE**: Not the type TYPE
+ **TYPE\_A & TYPE\_B**: argument has to satisfy type expression TYPE\_A and TYPE\_B,
quite academic but can be used with constructor functions and objects or with the 'not' modifier in a sane way.

### Parameter Modifiers ###
For each parameter a type must be specified, further the following modifier for parameters are available:

+ **TYPE?**: The parameter is optional
+ __TYPE*__ : The parameter is a vararg

The following rules apply to the above mentioned modifiers:

+ Vararg and optional parameter can't be used together in one parameter list.
+ Only one parameter can be declared vararg in a parameter list.
+ All optional parameters have to be in a row.
+ Optional parameter are matched from left to right.

### Expressions ###
Every SimpleType can be followed by a condition in double curly brackets:

**TYPE {{ COND }}**

This COND is a javascript expression that, if evaluated, must be a truthy value that the condition holds true.
If this condition is evaluated to a falsy value, the contract is violated.
The object that is matched by the TYPE is exposed to the expression as the variable $$
after the type has been successfully checked.
For example: To test if all elements of an array are numbers and are greater than zero you can express it this way:

    argsContract(arguments, '[ num {{ $$ > 0 }} ]');

Another feature is that you can express requirements between arguments by supplying additional arguments to the
argsContract call. The additional arguments must be strings and contain expressions that are evaluated to a truthy value.
The arguments of the method are bound to the variables $1 - $9.
For example: To specify that the first argument must be less or equal than the second argument you can express it like that:

    argsContract(arguments, 'num, num', '$1 <= $2');

# Browser Support #
* IE 8
* Chrome
* Firefox

# Distributed Files #
The 'dist' directory of the project contains the files that can be included in an project.
Because the contract checks are most useful in development stage and the source file with the generated parser is quite large

# Licences #
cs-args-contract is provided under the [Apache Licence Version 2](https://github.com/okrammer/cs-args-contract/blob/master/LICENSE.txt)

cs-args-contract uses a parser that is generated with the awsome [PEG.js](http://pegjs.majda.cz/) parser generator.
