import sys
t=open(sys.argv[1]).read().split('\n')
print(''.join(l for l in t if l.startswith("('")))
