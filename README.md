cs-args-contract
================

This library is used to check the arguments of a javascript function against a contract that is defined via a simple grammer.

# Licences #
cs-args-contract is provided under the [Apache Licence Version 2](https://github.com/okrammer/cs-args/contract/blob/master/LICENSE.txt)

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