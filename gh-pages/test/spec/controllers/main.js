'use strict';

describe('Controller: MainCtrl', function () {

  // load the controller's module
  beforeEach(module('csArgsContractGhPagesApp'));

  var MainCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    MainCtrl = $controller('MainCtrl', {
      $scope: scope
    });
  }));

  it('set up the contract and the parameter strings', function () {
    expect(scope.contract).not.toBeNull();
    expect(scope.parameter).not.toBeNull();
  });
});
