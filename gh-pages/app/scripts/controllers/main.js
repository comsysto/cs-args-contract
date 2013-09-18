'use strict';

/**
 * This function uses eval so put it on the most outer scope so it can't access anything.
 * @param contract
 * @param evalString
 */
/*jshint evil:true */
function doEval(contract, evalString) {
    function doSomething() {
        argsContract(arguments, contract);
    }

    doSomething.apply(window, eval('[' + evalString + ']'));
}

angular.module('csArgsContractGhPagesApp')
    .controller('MainCtrl', function($scope) {
        function reevalContract() {
            try {
                doEval($scope.contract, $scope.parameter);
                $scope.error = null;
            } catch (e) {
                if (e.message) {
                    $scope.error = e.message;
                } else {
                    $scope.error = e.toString();
                }

            }
        }


        $scope.$watch('contract', reevalContract);
        $scope.$watch('parameter', reevalContract);

        $scope.contract = 'str|num, [str|{name: str}]?';
        $scope.parameter = '\'hello\', [\'pete\',  {name: \'stefan\'}]';
    });
