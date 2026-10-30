@echo off
:: Tự động lấy tên thư mục hiện tại làm tên Repo
for %%I in (.) do set "repo_name=%%~nxI"

set /p msg="Nhap noi dung commit (neu bo trong se la 'initial commit'): "
if "%msg%"=="" set msg=initial commit

git init
git add .
git commit -m "%msg%"
git branch -M main

echo ------ Dang tu dong tao Repo [%repo_name%] tren GitHub... ------
:: LỆNH THẦN KỲ: Tự động tạo repo chế độ riêng tư (Private) trên tài khoản của bạn
:: Nếu bạn muốn tạo repo công khai (Public) thì đổi chữ --private thành --public nhé
gh repo create %repo_name% --private --source=. --remote=origin

echo ------ Dang day code len... ------
git push -u origin main

echo ------ XONG TINH! Check ngay GitHub cua ban ------
pause