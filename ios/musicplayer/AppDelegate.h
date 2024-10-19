#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <Expo/Expo.h>

@interface AppDelegate : EXAppDelegateWrapper
@property (nonatomic, strong) UIWindow *window;
@property (nonatomic, strong) UIView *rootView;
- (UISceneConfiguration *)application:(UIApplication *)application 
    configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession 
                                   options:(UISceneConnectionOptions *)options;
@end
