import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open(r'a:\файл шилжүүлэв\projects\ERP-connect\client\src\pages\Dashboard.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The corrupted section is lines 886-956 (0-indexed: 885-955)
# We need to replace lines 886 (index 885) through 956 (index 955)
# with the correct content

correct_block = [
    '                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">\n',
    '                                <span>{post.authorName}</span>\n',
    '                                <span>\u2022</span>\n',
    '                                <span>{format(new Date(post.createdAt), "MMM dd")}</span>\n',
    '                                <div className="flex items-center gap-3 ml-auto">\n',
    '                                  {post.likesCount > 0 && (\n',
    '                                    <span className="flex items-center gap-1">\n',
    '                                      <Heart className="w-3 h-3" />\n',
    '                                      {post.likesCount}\n',
    '                                    </span>\n',
    '                                  )}\n',
    '                                  {post.commentsCount > 0 && (\n',
    '                                    <span className="flex items-center gap-1">\n',
    '                                      <MessageCircle className="w-3 h-3" />\n',
    '                                      {post.commentsCount}\n',
    '                                    </span>\n',
    '                                  )}\n',
    '                                </div>\n',
    '                              </div>\n',
    '                            </div>\n',
    '                          </div>\n',
    '                        </div>\n',
    '                      ))}\n',
    '                    </div>\n',
    '                  </CardContent>\n',
    '                </Card>\n',
    '              )}\n',
    '            </ErrorBoundary>\n',
    '          </div>\n',
    '\n',
    '\n',
    '\n',
    '          {/* Real-time Salary Section - Role-based visibility */}\n',
    '          {\n',
    '            !zenMode && (userRole === "Admin" || userRole === "HR" || userRole === "Manager") && (\n',
    '              <div className="space-y-4 md:space-y-6">\n',
    '                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">\n',
    '                  <h3 className="text-base md:text-lg font-semibold shrink-0">\u042d\u043d\u044d \u0441\u0430\u0440\u044b\u043d \u043e\u0440\u043b\u043e\u0433\u043e (\u0410\u0436\u0438\u043b\u0442\u043d\u0443\u0443\u0434)</h3>\n',
    '                  {/* Quick Actions for HR */}\n',
    '                  <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden shrink-0">\n',
    '                    <Button\n',
    '                      variant="outline"\n',
    '                      size="sm"\n',
    '                      onClick={() => setLocation("/employees?action=create")}\n',
    '                      className="text-xs h-8 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 whitespace-nowrap shrink-0"\n',
    '                    >\n',
    '                      <UserPlus className="w-3 h-3 mr-1" />\n',
    '                      \u0410\u0436\u0438\u043b\u0442\u0430\u043d \u043d\u044d\u043c\u044d\u0445\n',
    '                    </Button>\n',
    '                    <Button\n',
    '                      variant="outline"\n',
    '                      size="sm"\n',
    '                      onClick={() => setLocation("/attendance?action=create")}\n',
    '                      className="text-xs h-8 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-950/40 whitespace-nowrap shrink-0"\n',
    '                    >\n',
    '                      <Calendar className="w-3 h-3 mr-1" />\n',
    '                      \u0418\u0440\u0446 \u0431\u04af\u0440\u0442\u0433\u044d\u0445\n',
    '                    </Button>\n',
    '                    <Button\n',
    '                      variant="outline"\n',
    '                      size="sm"\n',
    '                      onClick={() => setLocation("/payroll?action=create")}\n',
    '                      className="text-xs h-8 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 whitespace-nowrap shrink-0"\n',
    '                    >\n',
    '                      <Calculator className="w-3 h-3 mr-1" />\n',
    '                      \u0426\u0430\u043b\u0438\u043d \u0431\u043e\u0434\u043e\u0445\n',
    '                    </Button>\n',
    '                  </div>\n',
    '                </div>\n',
    '                <EnhancedSalaryCardsSection />\n',
    '              </div>\n',
    '            )\n',
    '          }\n',
]

# Replace lines 885 to 955 (0-indexed) with correct block
new_lines = lines[:885] + correct_block + lines[956:]

with open(r'a:\файл шилжүүлэв\projects\ERP-connect\client\src\pages\Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("SUCCESS: Dashboard fixed. New line count:", len(new_lines))
