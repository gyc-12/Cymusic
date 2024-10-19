#import "PhoneSceneDelegate.h"
#import "AppDelegate.h"  // 添加这行来导入 AppDelegate

@implementation PhoneSceneDelegate

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)connectionOptions {
    AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
    UIWindowScene *windowScene = (UIWindowScene *)scene;
    
    UIViewController *rootViewController = [[UIViewController alloc] init];
    rootViewController.view = appDelegate.rootView;
    
    UIWindow *window = [[UIWindow alloc] initWithWindowScene:windowScene];
    window.rootViewController = rootViewController;
    self.window = window;
    [window makeKeyAndVisible];
}

@end