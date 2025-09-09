@echo off
echo ========================================
echo Test de detection de produits Yukpo
echo ========================================
echo.

echo Verifier que le backend tourne sur le port 3001...
echo.

echo Lancement des tests de detection de produits...
python test_product_detection.py

echo.
echo Tests termines!
pause 