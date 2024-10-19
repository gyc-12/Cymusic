#import "CarSceneDelegate.h"
#import "CarSceneDelegate.h"
#import "RNCarPlay.h"

@implementation CarSceneDelegate

- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
      didConnectInterfaceController:(CPInterfaceController *)interfaceController {
    // Dispatch connect to RNCarPlay
    [RNCarPlay connectWithInterfaceController:interfaceController window:templateApplicationScene.carWindow];
}

- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
      didDisconnectInterfaceController:(CPInterfaceController *)interfaceController {
    // Dispatch disconnect to RNCarPlay
 in   [RNCarPlay disconnect];
}

@end