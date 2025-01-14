const { withDangerousMod, withPlugins, withXcodeProject } = require('@expo/config-plugins')
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode')
const fs = require('fs')
const path = require('path')

const withMultipleScenes = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectPath = config.modRequest.projectRoot;
    const iosPath = path.join(projectPath, 'ios');
    const appName = xcodeProject.getFirstTarget().firstTarget.name;
    
    // 创建 SceneDelegate.h
    const sceneDelegateHeaderPath = path.join(iosPath, appName, 'SceneDelegate.h');
    const sceneDelegateHeaderContent = `
#import <UIKit/UIKit.h>

@interface SceneDelegate : UIResponder <UIWindowSceneDelegate>

@property (strong, nonatomic) UIWindow * window;

@end
    `;
    fs.writeFileSync(sceneDelegateHeaderPath, sceneDelegateHeaderContent);

    // 创建 SceneDelegate.m
    const sceneDelegateImplPath = path.join(iosPath, appName, 'SceneDelegate.m');
    const sceneDelegateImplContent = `
#import "SceneDelegate.h"
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>

@implementation SceneDelegate

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)connectionOptions {
    if ([scene isKindOfClass:[UIWindowScene class]]) {
        UIWindowScene *windowScene = (UIWindowScene *)scene;
        self.window = [[UIWindow alloc] initWithWindowScene:windowScene];
        
        RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:nil];
        RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge
                                                        moduleName:@"${appName}"
                                                 initialProperties:nil];
        
        UIViewController *rootViewController = [UIViewController new];
        rootViewController.view = rootView;
        self.window.rootViewController = rootViewController;
        [self.window makeKeyAndVisible];
    }
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
    `;
    fs.writeFileSync(sceneDelegateImplPath, sceneDelegateImplContent);

    // 将文件添加到 Xcode 工程
    const groupName = appName;
    const headerFile = xcodeProject.addHeaderFile(
      `${appName}/SceneDelegate.h`,
      { target: xcodeProject.getFirstTarget().uuid },
      groupName
    );
    const implFile = xcodeProject.addSourceFile(
      `${appName}/SceneDelegate.m`,
      { target: xcodeProject.getFirstTarget().uuid },
      groupName
    );

    // 修改 AppDelegate.mm
    const appDelegatePath = path.join(iosPath, appName, 'AppDelegate.mm');
    const appDelegateContent = fs.readFileSync(appDelegatePath, 'utf-8');
    
    const modifiedAppDelegate = appDelegateContent.replace(
      '- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions',
      `- (UISceneConfiguration *)application:(UIApplication *)application configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession options:(UISceneConnectionOptions *)options {
    UISceneConfiguration *configuration = [[UISceneConfiguration alloc] initWithName:@"Default Configuration" sessionRole:connectingSceneSession.role];
    configuration.delegateClass = [SceneDelegate class];
    return configuration;
}

- (void)application:(UIApplication *)application didDiscardSceneSessions:(NSSet<UISceneSession *> *)sceneSessions {
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions`
    );

    fs.writeFileSync(appDelegatePath, modifiedAppDelegate);

    return config;
  });
};

module.exports = withMultipleScenes;
